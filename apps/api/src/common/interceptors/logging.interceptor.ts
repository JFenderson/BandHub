import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@hbcu-band-hub/observability';
import { getCorrelationId } from '@hbcu-band-hub/observability';

/**
 * Extended Express Request with user data from JWT authentication
 * Note: We override the 'id' property to make it optional since we generate it
 */
interface AuthenticatedRequest extends Omit<Request, 'id'> {
  user?: {
    userId: string;
    email: string;
    name?: string;
    role: string;
  };
  id?: string; // Request ID (optional, we generate if missing)
  correlationId?: string; // For distributed tracing
}

/**
 * Log levels for different severity types
 */
export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

/**
 * Structured log entry format for production JSON logging
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  correlationId?: string;
  method: string;
  url: string;
  path: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  query?: Record<string, any>;
  headers?: Record<string, string>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  performance?: {
    slow: boolean;
    threshold: number;
  };
  context?: string;
}

/**
 * Comprehensive Logging Interceptor for HBCU Band Hub API
 * 
 * Features:
 * - Request/response correlation with UUID request IDs
 * - Performance monitoring with slow query detection (>1000ms)
 * - User activity auditing (when authenticated)
 * - Structured JSON logging for production
 * - Error tracking with stack traces
 * - Distributed tracing via correlation IDs
 * - Sensitive header filtering
 * - Health check exclusion from verbose logging
 * - API usage analytics
 * 
 * Integration:
 * - Uses Pino logger from @hbcu-band-hub/observability
 * - Integrates with existing correlation ID middleware
 * - Works with JWT authentication guards
 * - Captures user data from request.user populated by JwtAuthGuard
 * 
 * @example
 * // Global registration in main.ts or app.module.ts
 * app.useGlobalInterceptors(new LoggingInterceptor());
 * 
 * @example
 * // Controller-level usage
 * @UseInterceptors(LoggingInterceptor)
 * @Controller('videos')
 * export class VideosController {}
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = createLogger('http-interceptor');
  private readonly fallbackLogger = new Logger(LoggingInterceptor.name);
  
  // Slow query threshold in milliseconds
  private readonly SLOW_QUERY_THRESHOLD = 1000;
  
  // Paths to exclude from verbose logging
  private readonly EXCLUDED_PATHS = [
    '/health',
    '/health/liveness',
    '/health/readiness',
    '/metrics',
    '/api/health',
    '/api/metrics',
  ];
  
  // Headers to exclude from logging (sensitive data)
  private readonly SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'x-access-token',
    'x-refresh-token',
    'x-csrf-token',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only handle HTTP requests
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();
    const response = httpContext.getResponse<Response>();
    
    // Generate or retrieve request ID
    const requestId = request.id || uuidv4();
    request.id = requestId;
    
    // Get correlation ID from existing middleware or generate new one
    const correlationId = getCorrelationId() || request.correlationId || uuidv4();
    request.correlationId = correlationId;
    
    // Add correlation ID to response headers for client-side tracing
    response.setHeader('X-Correlation-ID', correlationId);
    response.setHeader('X-Request-ID', requestId);
    
    const startTime = Date.now();
    const { method, url, path } = request;
    
    // Check if this is a health check or metrics endpoint
    const isExcludedPath = this.isExcludedPath(path);
    
    // Log incoming request (unless excluded)
    if (!isExcludedPath) {
      this.logRequest(request, requestId, correlationId);
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        // Log successful response
        this.logResponse(
          request,
          response,
          requestId,
          correlationId,
          duration,
          isExcludedPath,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log error response
        this.logError(
          request,
          error,
          requestId,
          correlationId,
          duration,
          isExcludedPath,
        );
        
        return throwError(() => error);
      }),
    );
  }

  /**
   * Log incoming HTTP request
   */
  private logRequest(
    request: AuthenticatedRequest,
    requestId: string,
    correlationId: string,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      requestId,
      correlationId,
      method: request.method,
      url: request.url,
      path: request.path,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      headers: this.filterSensitiveHeaders(request.headers),
      query: Object.keys(request.query).length > 0 ? request.query : undefined,
      user: this.extractUserInfo(request),
      context: 'REQUEST_START',
    };

    try {
      this.logger.info(logEntry, `→ ${request.method} ${request.path}`);
    } catch (error) {
      // Fallback to NestJS logger if Pino fails
      this.fallbackLogger.log(
        `→ ${request.method} ${request.path} [${requestId}]`,
      );
    }
  }

  /**
   * Log successful HTTP response
   */
  private logResponse(
    request: AuthenticatedRequest,
    response: Response,
    requestId: string,
    correlationId: string,
    duration: number,
    isExcludedPath: boolean,
  ): void {
    const statusCode = response.statusCode;
    const isSlow = duration > this.SLOW_QUERY_THRESHOLD;
    
    // Use appropriate log level based on status and performance
    let level: LogLevel = LogLevel.INFO;
    if (isSlow) {
      level = LogLevel.WARN;
    } else if (statusCode >= 400 && statusCode < 500) {
      level = LogLevel.WARN;
    } else if (statusCode >= 500) {
      level = LogLevel.ERROR;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      correlationId,
      method: request.method,
      url: request.url,
      path: request.path,
      statusCode,
      duration,
      ip: this.getClientIp(request),
      user: this.extractUserInfo(request),
      performance: isSlow
        ? {
            slow: true,
            threshold: this.SLOW_QUERY_THRESHOLD,
          }
        : undefined,
      context: 'REQUEST_COMPLETE',
    };

    // Skip verbose logging for excluded paths (just log minimal info)
    if (isExcludedPath) {
      try {
        this.logger.debug(
          { requestId, path: request.path, duration, statusCode },
          `✓ ${request.method} ${request.path} ${statusCode} ${duration}ms`,
        );
      } catch {
        // Silent fail for health checks
      }
      return;
    }

    try {
      // Log with appropriate level
      const message = isSlow
        ? `⚠ SLOW ${request.method} ${request.path} ${statusCode} ${duration}ms (threshold: ${this.SLOW_QUERY_THRESHOLD}ms)`
        : `✓ ${request.method} ${request.path} ${statusCode} ${duration}ms`;

      if (level === LogLevel.ERROR) {
        this.logger.error(logEntry, message);
      } else if (level === LogLevel.WARN) {
        this.logger.warn(logEntry, message);
      } else {
        this.logger.info(logEntry, message);
      }
    } catch (error) {
      // Fallback to NestJS logger
      this.fallbackLogger.log(
        `✓ ${request.method} ${request.path} ${statusCode} ${duration}ms [${requestId}]`,
      );
    }
  }

  /**
   * Log error response
   */
  private logError(
    request: AuthenticatedRequest,
    error: any,
    requestId: string,
    correlationId: string,
    duration: number,
    isExcludedPath: boolean,
  ): void {
    // Don't log errors for excluded paths in detail
    if (isExcludedPath) {
      return;
    }

    const statusCode = error.status || error.statusCode || 500;
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      requestId,
      correlationId,
      method: request.method,
      url: request.url,
      path: request.path,
      statusCode,
      duration,
      ip: this.getClientIp(request),
      user: this.extractUserInfo(request),
      error: {
        message: error.message || 'Unknown error',
        name: error.name,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      },
      context: 'REQUEST_ERROR',
    };

    try {
      this.logger.error(
        logEntry,
        `✗ ${request.method} ${request.path} ${statusCode} ${duration}ms - ${error.message}`,
      );
    } catch (logError) {
      // Fallback to NestJS logger
      this.fallbackLogger.error(
        `✗ ${request.method} ${request.path} ${statusCode} ${duration}ms [${requestId}]`,
        error.stack,
      );
    }
  }

  /**
   * Extract user information from authenticated request
   * User data is populated by JwtAuthGuard
   */
  private extractUserInfo(request: AuthenticatedRequest): LogEntry['user'] | undefined {
    if (!request.user) {
      return undefined;
    }

    return {
      userId: request.user.userId,
      email: request.user.email,
      role: request.user.role,
    };
  }

  /**
   * Get client IP address from request
   * Handles proxied requests and X-Forwarded-For header
   */
  private getClientIp(request: AuthenticatedRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  /**
   * Filter out sensitive headers from logging
   * Prevents leaking authorization tokens, cookies, etc.
   */
  private filterSensitiveHeaders(headers: any): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      // Skip sensitive headers
      if (this.SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        filtered[key] = value;
      } else if (Array.isArray(value)) {
        filtered[key] = value.join(', ');
      }
    }
    
    return filtered;
  }

  /**
   * Check if path should be excluded from verbose logging
   * Health checks and metrics endpoints are excluded
   */
  private isExcludedPath(path: string): boolean {
    return this.EXCLUDED_PATHS.some((excludedPath) =>
      path.toLowerCase().includes(excludedPath.toLowerCase()),
    );
  }
}