/**
 * Rate Limit Configuration
 * 
 * Centralized configuration for all rate limiting rules.
 * Different limits for different endpoint types based on security and usage patterns.
 */

import { RateLimitConfig, RateLimitType } from '../common/interfaces/rate-limit.interface';

/**
 * Rate limiting rules for HBCU Band Hub API
 * 
 * Design principles:
 * - Authentication endpoints: Very restrictive to prevent brute force
 * - Public API: Moderate limits to prevent abuse while allowing legitimate use
 * - Admin endpoints: Higher limits for authenticated administrators
 * - Search endpoints: Moderate limits to prevent scraping
 * - File uploads: Restrictive to prevent storage abuse
 */
export const RATE_LIMIT_CONFIGS = {
  /**
   * Default rate limit for all endpoints
   * Applies unless overridden by specific rules
   */
  default: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    type: RateLimitType.IP,
    message: 'Too many requests. Please try again later.',
  } as RateLimitConfig,

  /**
   * Authentication endpoints (login, register, password reset)
   * Very restrictive to prevent brute force and credential stuffing attacks
   */
  auth: {
    login: {
      limit: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      type: RateLimitType.IP,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
    register: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.IP,
      message: 'Too many registration attempts. Please try again later.',
    },
    forgotPassword: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.IP,
      message: 'Too many password reset requests. Please try again later.',
    },
    resetPassword: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.IP,
      message: 'Too many password reset attempts. Please try again later.',
    },
    refresh: {
      limit: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      type: RateLimitType.IP,
      message: 'Too many token refresh requests. Please try again later.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * Public API endpoints (bands, videos - read operations)
   * Moderate limits to prevent scraping while allowing legitimate browsing
   */
  publicApi: {
    read: {
      limit: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.IP,
      message: 'Too many requests. Please slow down.',
    },
    list: {
      limit: 60,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.IP,
      message: 'Too many listing requests. Please try again later.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * Search endpoints
   * More restrictive to prevent scraping and resource exhaustion
   */
  search: {
    text: {
      limit: 20,
      windowMs: 60 * 1000, // 1 minute
      type: RateLimitType.IP,
      message: 'Too many search requests. Please slow down.',
    },
    advanced: {
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
      type: RateLimitType.IP,
      message: 'Too many advanced search requests. Please slow down.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * Admin endpoints
   * Higher limits for authenticated administrators
   * Uses USER type to track per-user instead of per-IP
   */
  admin: {
    read: {
      limit: 1000,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Admin rate limit exceeded. Please contact support.',
    },
    write: {
      limit: 500,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Admin write rate limit exceeded. Please contact support.',
    },
    bulk: {
      limit: 50,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Bulk operation rate limit exceeded. Please wait before trying again.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * File upload endpoints
   * Very restrictive to prevent storage abuse
   */
  upload: {
    image: {
      limit: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many file uploads. Please try again later.',
    },
    logo: {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many logo uploads. Please try again later.',
    },
    banner: {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many banner uploads. Please try again later.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * User-specific endpoints (favorites, notifications)
   * Moderate limits for authenticated users
   */
  user: {
    favorites: {
      limit: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many favorite requests. Please slow down.',
    },
    notifications: {
      limit: 50,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many notification requests. Please slow down.',
    },
  } as Record<string, RateLimitConfig>,

  /**
   * Sync/Worker trigger endpoints
   * Very restrictive as these are resource-intensive operations
   */
  sync: {
    trigger: {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      type: RateLimitType.USER,
      message: 'Too many sync requests. Please wait before triggering another sync.',
    },
  } as Record<string, RateLimitConfig>,
};

/**
 * IP addresses that bypass rate limiting
 * Typically internal services, monitoring tools, etc.
 */
export const RATE_LIMIT_WHITELIST = [
//   '127.0.0.1', // Localhost
//   '::1', // Localhost IPv6
  // Add your monitoring service IPs here
  // Add your internal service IPs here
];

/**
 * User roles that have reduced rate limits or bypass rate limiting
 */
export const RATE_LIMIT_BYPASS_ROLES = [
  'SUPER_ADMIN', // Super admins bypass most rate limits
];

/**
 * Endpoints that skip rate limiting entirely
 * Typically health checks and metrics endpoints
 */
export const RATE_LIMIT_SKIP_PATHS = [
  '/api/health',
  '/api/health/ready',
  '/api/health/live',
  '/api/health/database',
  '/api/health/cache',
  '/api/health/queues',
  '/api/health/external/youtube',
  '/api/metrics',
];

/**
 * Get rate limit configuration for a specific endpoint
 */
export function getRateLimitConfig(
  category: keyof typeof RATE_LIMIT_CONFIGS,
  subcategory?: string,
): RateLimitConfig {
  const categoryConfig = RATE_LIMIT_CONFIGS[category];
  
  if (typeof categoryConfig === 'object' && 'limit' in categoryConfig) {
    // Direct config (e.g., default)
    return categoryConfig as RateLimitConfig;
  }
  
  if (subcategory && typeof categoryConfig === 'object') {
    // Nested config (e.g., auth.login)
    const config = (categoryConfig as Record<string, RateLimitConfig>)[subcategory];
    if (config) {
      return config;
    }
  }
  
  // Fallback to default
  return RATE_LIMIT_CONFIGS.default;
}