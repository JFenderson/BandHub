/**
 * Redis Rate Limiter Service
 * 
 * Implements distributed rate limiting using Redis with a sliding window algorithm.
 * This is more accurate than fixed windows and prevents burst abuse at window boundaries.
 * 
 * Algorithm: Sliding Window with Sorted Sets
 * - Uses Redis sorted sets to track request timestamps
 * - Removes old requests outside the time window
 * - Counts requests in the current window
 * - Adds new request if under limit
 * 
 * This approach works well across multiple API instances (horizontal scaling).
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import {
  RateLimitConfig,
  RateLimitResult,
  RateLimitType,
  IpListEntry,
  IpListOptions,
} from '../interfaces/rate-limit.interface';

@Injectable()
export class RedisRateLimiterService {
  private readonly logger = new Logger(RedisRateLimiterService.name);

  // Redis key prefixes
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly WHITELIST_PREFIX = 'whitelist:ip:';
  private readonly BLACKLIST_PREFIX = 'blacklist:ip:';
  private readonly METRICS_PREFIX = 'rate_limit:metrics:';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get Redis client (lazy getter to ensure CacheService is initialized)
   */
  private get redis() {
    return this.cacheService.getClient();
  }

  /**
   * Check if a request should be rate limited
   * Uses sliding window algorithm with Redis sorted sets
   * 
   * @param key - Unique identifier for rate limiting (IP, user ID, etc.)
   * @param config - Rate limit configuration
   * @returns Rate limit result with allowed status and metadata
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const redisKey = `${this.RATE_LIMIT_PREFIX}${key}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use a Lua script for atomic operations
      // This ensures consistency across multiple API instances
      const result = await this.redis.eval(
        `
        -- Remove old requests outside the window
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
        
        -- Count current requests in window
        local current = redis.call('ZCARD', KEYS[1])
        
        -- Check if under limit
        if current < tonumber(ARGV[3]) then
          -- Add new request
          redis.call('ZADD', KEYS[1], ARGV[2], ARGV[2])
          redis.call('EXPIRE', KEYS[1], ARGV[4])
          return {1, current + 1}
        else
          return {0, current}
        end
        `,
        1, // Number of keys
        redisKey, // KEYS[1]
        windowStart, // ARGV[1] - Window start time
        now, // ARGV[2] - Current timestamp
        config.limit, // ARGV[3] - Max requests allowed
        Math.ceil(config.windowMs / 1000), // ARGV[4] - TTL in seconds
      );

      const [allowed, current] = result as [number, number];
      const remaining = Math.max(0, config.limit - current);

      // Calculate when the window resets
      // Get the oldest request in the window to determine reset time
      const oldestRequest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetMs = oldestRequest.length > 0
        ? Math.max(0, parseInt(oldestRequest[1]) + config.windowMs - now)
        : config.windowMs;

      const rateLimitResult: RateLimitResult = {
        allowed: allowed === 1,
        current,
        limit: config.limit,
        remaining,
        resetMs,
        resetAt: now + resetMs,
      };

      // Track metrics
      if (!rateLimitResult.allowed) {
        await this.incrementMetric('blocked', key);
        this.logger.warn(
          `Rate limit exceeded for key: ${key} (${current}/${config.limit})`,
        );
      }

      return rateLimitResult;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${key}:`, error);
      
      // Fail open - allow the request if Redis is down
      // This prevents cascading failures but should trigger alerts
      return {
        allowed: true,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetMs: config.windowMs,
        resetAt: now + config.windowMs,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   * Useful for manual intervention or testing
   */
  async resetRateLimit(key: string): Promise<void> {
    const redisKey = `${this.RATE_LIMIT_PREFIX}${key}`;
    await this.redis.del(redisKey);
    this.logger.log(`Rate limit reset for key: ${key}`);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const redisKey = `${this.RATE_LIMIT_PREFIX}${key}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Remove old requests
      await this.redis.zremrangebyscore(redisKey, 0, windowStart);
      
      // Count current requests
      const current = await this.redis.zcard(redisKey);
      const remaining = Math.max(0, config.limit - current);

      // Get oldest request for reset calculation
      const oldestRequest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetMs = oldestRequest.length > 0
        ? Math.max(0, parseInt(oldestRequest[1]) + config.windowMs - now)
        : config.windowMs;

      return {
        allowed: current < config.limit,
        current,
        limit: config.limit,
        remaining,
        resetMs,
        resetAt: now + resetMs,
      };
    } catch (error) {
      this.logger.error(`Failed to get rate limit status for ${key}:`, error);
      
      return {
        allowed: true,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetMs: config.windowMs,
        resetAt: now + config.windowMs,
      };
    }
  }

  /**
   * Add IP to whitelist (bypasses rate limiting)
   */
  async addToWhitelist(ip: string, options?: IpListOptions): Promise<void> {
    const key = `${this.WHITELIST_PREFIX}${ip}`;
    const entry: IpListEntry = {
      ip,
      reason: options?.reason,
      addedAt: new Date(),
      expiresAt: options?.ttl ? new Date(Date.now() + options.ttl * 1000) : undefined,
    };

    if (options?.ttl) {
      await this.cacheService.set(key, entry, options.ttl);
    } else {
      await this.cacheService.set(key, entry);
    }

    this.logger.log(`Added ${ip} to whitelist. Reason: ${options?.reason || 'N/A'}`);
  }

  /**
   * Remove IP from whitelist
   */
  async removeFromWhitelist(ip: string): Promise<void> {
    const key = `${this.WHITELIST_PREFIX}${ip}`;
    await this.cacheService.del(key);
    this.logger.log(`Removed ${ip} from whitelist`);
  }

  /**
   * Check if IP is whitelisted
   */
  async isWhitelisted(ip: string): Promise<boolean> {
    const key = `${this.WHITELIST_PREFIX}${ip}`;
    return await this.cacheService.exists(key);
  }

  /**
   * Add IP to blacklist (blocks all requests)
   */
  async addToBlacklist(ip: string, options?: IpListOptions): Promise<void> {
    const key = `${this.BLACKLIST_PREFIX}${ip}`;
    const entry: IpListEntry = {
      ip,
      reason: options?.reason,
      addedAt: new Date(),
      expiresAt: options?.ttl ? new Date(Date.now() + options.ttl * 1000) : undefined,
    };

    if (options?.ttl) {
      await this.cacheService.set(key, entry, options.ttl);
    } else {
      await this.cacheService.set(key, entry);
    }

    this.logger.warn(`Added ${ip} to blacklist. Reason: ${options?.reason || 'N/A'}`);
  }

  /**
   * Remove IP from blacklist
   */
  async removeFromBlacklist(ip: string): Promise<void> {
    const key = `${this.BLACKLIST_PREFIX}${ip}`;
    await this.cacheService.del(key);
    this.logger.log(`Removed ${ip} from blacklist`);
  }

  /**
   * Check if IP is blacklisted
   */
  async isBlacklisted(ip: string): Promise<boolean> {
    const key = `${this.BLACKLIST_PREFIX}${ip}`;
    return await this.cacheService.exists(key);
  }

  /**
   * Increment a metrics counter
   */
  private async incrementMetric(metric: string, key?: string): Promise<void> {
    try {
      const metricsKey = key 
        ? `${this.METRICS_PREFIX}${metric}:${key}`
        : `${this.METRICS_PREFIX}${metric}`;
      
      await this.redis.incr(metricsKey);
      await this.redis.expire(metricsKey, 86400); // 24 hour TTL
    } catch (error) {
      // Don't fail the request if metrics tracking fails
      this.logger.error(`Failed to increment metric ${metric}:`, error);
    }
  }

  /**
   * Get rate limiting metrics
   */
  async getMetrics(): Promise<{
    totalBlocked: number;
    blockedByKey: Record<string, number>;
  }> {
    try {
      const totalBlocked = await this.redis.get(`${this.METRICS_PREFIX}blocked`) || 0;
      
      // Get all blocked keys
      const keys = await this.redis.keys(`${this.METRICS_PREFIX}blocked:*`);
      const blockedByKey: Record<string, number> = {};
      
      for (const key of keys) {
        const count = await this.redis.get(key);
        const identifier = key.replace(`${this.METRICS_PREFIX}blocked:`, '');
        blockedByKey[identifier] = parseInt(count) || 0;
      }

      return {
        totalBlocked: parseInt(totalBlocked as string) || 0,
        blockedByKey,
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit metrics:', error);
      return {
        totalBlocked: 0,
        blockedByKey: {},
      };
    }
  }
}