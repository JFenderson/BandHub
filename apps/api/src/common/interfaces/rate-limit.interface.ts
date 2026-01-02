/**
 * Rate Limit Interfaces
 * 
 * Defines TypeScript interfaces for rate limiting configuration,
 * responses, and metrics tracking.
 */

/**
 * Rate limit configuration for a specific endpoint or route
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Type of rate limiting to apply
   */
  type: RateLimitType;

  /**
   * Custom message to return when rate limit is exceeded
   */
  message?: string;

  /**
   * Whether to skip rate limiting for this endpoint
   */
  skip?: boolean;

  /**
   * Custom key generator function
   */
  keyGenerator?: (context: any) => string;
}

/**
 * Type of rate limiting
 */
export enum RateLimitType {
  /**
   * Limit by IP address
   */
  IP = 'ip',

  /**
   * Limit by authenticated user ID
   */
  USER = 'user',

  /**
   * Limit by both IP and user (most restrictive)
   */
  IP_AND_USER = 'ip_and_user',

  /**
   * Global limit (same for everyone)
   */
  GLOBAL = 'global',
}

/**
 * Rate limit check result from Redis
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Current count of requests in the window
   */
  current: number;

  /**
   * Maximum allowed requests
   */
  limit: number;

  /**
   * Remaining requests in the window
   */
  remaining: number;

  /**
   * Time until the window resets (in milliseconds)
   */
  resetMs: number;

  /**
   * Timestamp when the window resets (Unix timestamp in ms)
   */
  resetAt: number;
}

/**
 * Rate limit metadata to attach to request
 */
export interface RateLimitMetadata {
  /**
   * Identifier used for rate limiting (IP, user ID, etc.)
   */
  key: string;

  /**
   * Type of rate limit applied
   */
  type: RateLimitType;

  /**
   * Result of the rate limit check
   */
  result: RateLimitResult;

  /**
   * Configuration used for this check
   */
  config: RateLimitConfig;
}

/**
 * IP whitelist/blacklist entry
 */
export interface IpListEntry {
  /**
   * IP address or CIDR range
   */
  ip: string;

  /**
   * Reason for whitelisting/blacklisting
   */
  reason?: string;

  /**
   * When this entry was added
   */
  addedAt: Date;

  /**
   * When this entry expires (optional)
   */
  expiresAt?: Date;
}

/**
 * Rate limiting metrics for monitoring
 */
export interface RateLimitMetrics {
  /**
   * Total requests checked
   */
  totalRequests: number;

  /**
   * Total requests blocked
   */
  blockedRequests: number;

  /**
   * Requests allowed
   */
  allowedRequests: number;

  /**
   * Block rate (percentage)
   */
  blockRate: number;

  /**
   * Breakdown by endpoint
   */
  byEndpoint: Map<string, EndpointMetrics>;

  /**
   * Breakdown by limit type
   */
  byType: Map<RateLimitType, number>;
}

/**
 * Metrics for a specific endpoint
 */
export interface EndpointMetrics {
  /**
   * Endpoint path
   */
  path: string;

  /**
   * Total requests to this endpoint
   */
  totalRequests: number;

  /**
   * Requests blocked
   */
  blockedRequests: number;

  /**
   * Average requests per minute
   */
  avgRequestsPerMinute: number;
}

/**
 * Options for IP whitelisting/blacklisting
 */
export interface IpListOptions {
  /**
   * Time-to-live in seconds (for temporary entries)
   */
  ttl?: number;

  /**
   * Reason for adding to list
   */
  reason?: string;
}