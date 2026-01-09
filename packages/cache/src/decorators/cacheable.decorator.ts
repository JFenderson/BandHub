import { SetMetadata } from '@nestjs/common';

/**
 * Cache configuration metadata key
 */
export const CACHE_CONFIG_KEY = 'cache:config';

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  /**
   * Cache key prefix or function to generate key
   * If function, it receives method arguments and should return a string
   */
  keyGenerator: string | ((...args: any[]) => string);

  /**
   * Time to live in seconds
   */
  ttl: number;

  /**
   * Whether to compress large payloads
   * @default true
   */
  compress?: boolean;

  /**
   * Cache namespace for metrics
   */
  namespace?: string;
}

/**
 * Cacheable decorator
 * 
 * Mark a method to automatically cache its results
 * 
 * @example
 * ```ts
 * @Cacheable({
 *   keyGenerator: (bandId: string) => `band:${bandId}`,
 *   ttl: CACHE_TTL.BAND_PROFILE,
 * })
 * async getBand(bandId: string) {
 *   return this.db.band.findUnique({ where: { id: bandId } });
 * }
 * ```
 * 
 * Note: This requires CacheInterceptor to be applied at controller level
 */
export const Cacheable = (config: CacheConfig) => SetMetadata(CACHE_CONFIG_KEY, config);