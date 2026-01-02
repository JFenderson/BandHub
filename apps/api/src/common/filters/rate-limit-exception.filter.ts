/**
 * Rate Limit Exception Filter
 * 
 * Custom exception filter for handling rate limit violations.
 * Returns proper HTTP 429 (Too Many Requests) responses with:
 * - Retry-After header (when to retry)
 * - X-RateLimit-* headers (limit info)
 * - Custom error messages
 * 
 * This filter catches ThrottlerException from NestJS and our custom
 * rate limit errors, ensuring consistent response format.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { RateLimitResult } from '../interfaces/rate-limit.interface';
import { HttpException } from '@nestjs/common';

/**
 * Custom exception for rate limiting
 */
export class RateLimitException extends HttpException {
  result: any;
  constructor(
    message: string,
    public readonly rateLimitInfo: RateLimitResult,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message,
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        resetAt: rateLimitInfo.resetAt,
        retryAfter: `${Math.ceil(rateLimitInfo.resetMs / 1000)} seconds`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Exception filter for rate limit errors
 * Catches both ThrottlerException and RateLimitException
 */
@Catch(ThrottlerException, RateLimitException)
export class RateLimitExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RateLimitExceptionFilter.name);

  catch(exception: ThrottlerException | RateLimitException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Extract rate limit info
    let message: string;
    let retryAfter: number;
    let limit: number | undefined;
    let remaining: number | undefined;
    let resetAt: number | undefined;

    if (exception instanceof RateLimitException) {
      // Custom rate limit exception with full metadata
      message = exception.message;
      retryAfter = Math.ceil(exception.result.resetMs / 1000); // Convert to seconds
      limit = exception.result.limit;
      remaining = exception.result.remaining;
      resetAt = exception.result.resetAt;
    } else {
      // NestJS ThrottlerException (fallback)
      message = exception.message || 'Too many requests. Please try again later.';
      retryAfter = 60; // Default to 60 seconds
    }

    // Log the rate limit violation
    this.logger.warn(
      `Rate limit exceeded: ${request.method} ${request.url} - ` +
      `IP: ${request.realIp || request.ip} - ` +
      `User: ${request.user?.id || 'anonymous'}`,
    );

    // Build response body
    const responseBody = {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message,
      ...(limit !== undefined && { limit }),
      ...(remaining !== undefined && { remaining }),
      ...(resetAt !== undefined && { resetAt }),
      retryAfter: `${retryAfter} seconds`,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Set rate limit headers
    response.setHeader('Retry-After', retryAfter);
    
    if (limit !== undefined) {
      response.setHeader('X-RateLimit-Limit', limit);
    }
    
    if (remaining !== undefined) {
      response.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    }
    
    if (resetAt !== undefined) {
      response.setHeader('X-RateLimit-Reset', Math.floor(resetAt / 1000)); // Unix timestamp
    }

    // Send response
    response.status(HttpStatus.TOO_MANY_REQUESTS).json(responseBody);
  }
}