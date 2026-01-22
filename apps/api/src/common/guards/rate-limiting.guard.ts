/**
 * Rate Limiting Guard
 * 
 * Main guard that applies rate limiting to requests.
 * Integrates with:
 * - RedisRateLimiterService for distributed rate limiting
 * - Custom decorators for per-endpoint configuration
 * - IP extraction middleware for accurate identification
 * - Role-based bypass for admins
 * - Whitelist/blacklist functionality
 * 
 * This guard runs early in the request pipeline to block
 * rate-limited requests before they consume resources.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisRateLimiterService } from '../services/redis-rate-limiter.service';
import {
  RateLimitConfig,
  RateLimitType,
  RateLimitMetadata,
} from '../interfaces/rate-limit.interface';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';
import {
  RATE_LIMIT_CONFIGS,
  RATE_LIMIT_WHITELIST,
  RATE_LIMIT_BYPASS_ROLES,
  RATE_LIMIT_SKIP_PATHS,
} from '../../config/rate-limit.config';
import { RateLimitException } from '../filters/rate-limit-exception.filter';
import { RequestWithIp } from '../middleware/ip-extractor.middleware';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: RedisRateLimiterService,
    private readonly metricsService: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIp>();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Check if rate limiting should be skipped
    if (this.shouldSkipRateLimiting(request, handler, classRef)) {
      return true;
    }

    // Get IP address (set by IpExtractorMiddleware)
    const ip = request.realIp || request.ip || '0.0.0.0';

    // Check whitelist
    if (await this.isWhitelisted(ip)) {
      this.logger.debug(`Request from whitelisted IP: ${ip}`);
      return true;
    }

    // Check blacklist
    if (await this.rateLimiterService.isBlacklisted(ip)) {
      this.logger.warn(`Blocked request from blacklisted IP: ${ip}`);
      throw new RateLimitException(
        'Your IP address has been blocked. Please contact support.',
        {
          allowed: false,
          current: 0,
          limit: 0,
          remaining: 0,
          resetMs: 0,
          resetAt: Date.now(),
        },
      );
    }

    // Check if user has bypass role (e.g., SUPER_ADMIN)
    if (this.userHasBypassRole(request)) {
      const userId = (request.user as any)?.id;
      this.logger.debug(`Rate limit bypassed for admin user: ${userId}`);
      return true;
    }

    // Get rate limit configuration for this endpoint
    const config = this.getRateLimitConfig(handler, classRef);

    // Generate rate limit key based on config type
    const key = this.generateRateLimitKey(request, config);

    // Check rate limit
    const result = await this.rateLimiterService.checkRateLimit(key, config);

    // Track metrics
    const path = request.route?.path || request.path || request.url;
    const isAuthenticated = !!request.user;
    
    this.metricsService.rateLimitRequests.inc({
      endpoint: path,
      type: config.type,
      user_authenticated: String(isAuthenticated),
      allowed: String(result.allowed),
    });

    // Attach rate limit metadata to request for logging/monitoring
    request['rateLimitMetadata'] = {
      key,
      type: config.type,
      result,
      config,
    } as RateLimitMetadata;

    // Set rate limit headers on response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    response.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    // Block if rate limit exceeded
    if (!result.allowed) {
      // Track rate limit exceeded metric
      this.metricsService.rateLimitExceeded.inc({
        endpoint: path,
        type: config.type,
        user_authenticated: String(isAuthenticated),
      });
      
      throw new RateLimitException(
        config.message || 'Too many requests. Please try again later.',
        result,
      );
    }

    return true;
  }

  /**
   * Determine if rate limiting should be skipped for this request
   */
  private shouldSkipRateLimiting(
    request: RequestWithIp,
    handler: Function,
    classRef: Function,
  ): boolean {
    // Check @SkipRateLimit() decorator on handler or class
    const skipHandler = this.reflector.get<boolean>(
      SKIP_RATE_LIMIT_KEY,
      handler,
    );
    const skipClass = this.reflector.get<boolean>(
      SKIP_RATE_LIMIT_KEY,
      classRef,
    );

    if (skipHandler || skipClass) {
      return true;
    }

    // Check if path is in skip list (health checks, metrics)
    const path = request.path || request.url;
    if (RATE_LIMIT_SKIP_PATHS.some(skipPath => path.startsWith(skipPath))) {
      return true;
    }

    return false;
  }

  /**
   * Check if IP is whitelisted
   */
  private async isWhitelisted(ip: string): Promise<boolean> {
    // Check static whitelist
    if (RATE_LIMIT_WHITELIST.includes(ip)) {
      return true;
    }

    // Check dynamic whitelist in Redis
    return await this.rateLimiterService.isWhitelisted(ip);
  }

  /**
   * Check if user has a role that bypasses rate limiting
   */
  private userHasBypassRole(request: RequestWithIp): boolean {
    const user = request.user as any;
    
    if (!user || !user.role) {
      return false;
    }

    return RATE_LIMIT_BYPASS_ROLES.includes(user.role);
  }

  /**
   * Get rate limit configuration for the current endpoint
   * Checks for custom decorator config, then falls back to defaults
   */
  private getRateLimitConfig(
    handler: Function,
    classRef: Function,
  ): RateLimitConfig {
    // Check for handler-level custom config
    const handlerConfig = this.reflector.get<Partial<RateLimitConfig>>(
      RATE_LIMIT_KEY,
      handler,
    );

    // Check for class-level custom config
    const classConfig = this.reflector.get<Partial<RateLimitConfig>>(
      RATE_LIMIT_KEY,
      classRef,
    );

    // Merge configs (handler takes precedence over class)
    const customConfig = { ...classConfig, ...handlerConfig };

    // If custom config exists, merge with defaults
    if (customConfig && Object.keys(customConfig).length > 0) {
      return {
        ...RATE_LIMIT_CONFIGS.default,
        ...customConfig,
      };
    }

    // Use default config
    return RATE_LIMIT_CONFIGS.default;
  }

  /**
   * Generate rate limit key based on config type
   */
  private generateRateLimitKey(
    request: RequestWithIp,
    config: RateLimitConfig,
  ): string {
    const ip = request.realIp || request.ip || '0.0.0.0';
    const userId = (request.user as any)?.id;
    const path = request.route?.path || request.path || request.url;

    // Use custom key generator if provided
    if (config.keyGenerator) {
      return config.keyGenerator({ request, ip, userId, path });
    }

    // Generate key based on type
    switch (config.type) {
      case RateLimitType.IP:
        return `ip:${ip}:${path}`;

      case RateLimitType.USER:
        if (!userId) {
          // Fallback to IP if user not authenticated
          return `ip:${ip}:${path}`;
        }
        return `user:${userId}:${path}`;

      case RateLimitType.IP_AND_USER:
        if (!userId) {
          return `ip:${ip}:${path}`;
        }
        return `ip_user:${ip}:${userId}:${path}`;

      case RateLimitType.GLOBAL:
        return `global:${path}`;

      default:
        return `ip:${ip}:${path}`;
    }
  }
}