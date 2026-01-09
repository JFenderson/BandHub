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
