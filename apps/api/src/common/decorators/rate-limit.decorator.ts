/**
 * Rate Limit Decorators
 * 
 * Custom decorators for applying rate limits to specific endpoints.
 * These decorators work with the RateLimitingGuard to configure
 * per-endpoint rate limiting behavior.
 */

import { SetMetadata } from '@nestjs/common';
import { RateLimitConfig } from '../interfaces/rate-limit.interface';

/**
 * Metadata key for rate limit configuration
 */
export const RATE_LIMIT_KEY = 'rate_limit_config';

/**
 * Metadata key for skipping rate limiting
 */
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

/**
 * Apply custom rate limiting to an endpoint
 * 
 * @example
 * ```typescript
 * @Post('login')
 * @RateLimit({
 *   limit: 5,
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   type: RateLimitType.IP,
 *   message: 'Too many login attempts'
 * })
 * async login(@Body() dto: LoginDto) {
 *   // ...
 * }
 * ```
 */
export const RateLimit = (config: Partial<RateLimitConfig>) =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Skip rate limiting for a specific endpoint
 * Useful for health checks, metrics, and other monitoring endpoints
 * 
 * @example
 * ```typescript
 * @Get('health')
 * @SkipRateLimit()
 * async healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Apply authentication-specific rate limits
 * Pre-configured for login/auth endpoints
 * 
 * @example
 * ```typescript
 * @Post('login')
 * @AuthRateLimit()
 * async login(@Body() dto: LoginDto) {
 *   // ...
 * }
 * ```
 */
export const AuthRateLimit = () =>
  RateLimit({
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  });

/**
 * Apply search-specific rate limits
 * Pre-configured for search endpoints
 * 
 * @example
 * ```typescript
 * @Get('search')
 * @SearchRateLimit()
 * async search(@Query() query: SearchDto) {
 *   // ...
 * }
 * ```
 */
export const SearchRateLimit = () =>
  RateLimit({
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many search requests. Please slow down.',
  });

/**
 * Apply upload-specific rate limits
 * Pre-configured for file upload endpoints
 * 
 * @example
 * ```typescript
 * @Post('upload')
 * @UploadRateLimit()
 * async uploadFile(@UploadedFile() file: Express.Multer.File) {
 *   // ...
 * }
 * ```
 */
export const UploadRateLimit = () =>
  RateLimit({
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many file uploads. Please try again later.',
  });

/**
 * Apply admin-specific rate limits
 * Pre-configured for admin endpoints with higher limits
 * 
 * @example
 * ```typescript
 * @Get('admin/dashboard')
 * @AdminRateLimit()
 * async getDashboard() {
 *   // ...
 * }
 * ```
 */
export const AdminRateLimit = () =>
  RateLimit({
    limit: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Admin rate limit exceeded.',
  });