/**
 * Statistics for a single cache key or namespace
 */
export class CacheStats {
  key: string;

  hits: number;

  misses: number;

  hitRate: number;
}

/**
 * SWR (Stale-While-Revalidate) metrics
 */
export interface SWRMetrics {
  hits: number;           // Cache hits (fresh data)
  staleHits: number;      // Stale data served while revalidating
  misses: number;         // Cache misses (fetch fresh)
  revalidations: number;  // Background revalidations
  errors: number;         // Revalidation errors
}

/**
 * Overall cache metrics for monitoring
 */
export class CacheMetricsDto {
  hits: number;

  misses: number;

  hitRate: number;

  totalRequests: number;

  usedMemoryBytes: number;

  usedMemoryMB: number;

  topKeys: CacheStats[];

  swr?: SWRMetrics;
}

/**
 * Detailed cache health information
 */
export class CacheHealthDto {
  healthy: boolean;

  status: string;

  eTimeMs: number;

  memory?: {
    used: string;
    peak: string;
    fragmentationRatio: string;
  };
}
