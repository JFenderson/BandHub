import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheCompressionService } from './cache-compression.service';
import { CacheMetricsDto, CacheStats } from './dto/cache-metrics.dto';

/**
 * Cache TTL constants (in seconds)
 * Based on data volatility and access patterns
 */
export const CACHE_TTL = {
  // Band data changes infrequently (only when admin updates)
  BAND_PROFILE: 3600,          // 1 hour
  BAND_LIST: 3600,             // 1 hour
  BAND_STATS: 1800,            // 30 minutes
  
  // Video lists change as new videos sync
  VIDEO_LIST: 900,             // 15 minutes
  VIDEO_DETAIL: 3600,          // 1 hour
  
  // Search results can be cached but should refresh regularly
  SEARCH_RESULTS: 1800,        // 30 minutes
  SEARCH_SUGGESTIONS: 3600,    // 1 hour
  
  // YouTube API responses are expensive - cache longer
  YOUTUBE_VIDEO: 21600,        // 6 hours
  YOUTUBE_CHANNEL: 21600,      // 6 hours
  YOUTUBE_SEARCH: 10800,       // 3 hours
  
  // Trending/popular data needs frequent updates
  TRENDING_VIDEOS: 3600,       // 1 hour
  POPULAR_BANDS: 3600,         // 1 hour
  
  // User session and preferences
  USER_SESSION: 86400,         // 24 hours
  USER_PREFERENCES: 86400,     // 24 hours
  
  // Categories rarely change
  CATEGORIES: 7200,            // 2 hours
  
  // Admin dashboard stats
  DASHBOARD_STATS: 300,        // 5 minutes
} as const;

/**
 * Compression threshold in bytes
 * Data larger than this will be compressed before caching
 */
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * CacheStrategyService
 * 
 * Central caching orchestrator with:
 * - Automatic compression for large payloads
 * - Hit/miss metrics tracking
 * - Pattern-based invalidation
 * - Graceful error handling
 * 
 * Usage:
 * ```ts
 * const data = await cacheStrategy.wrap(
 *   CacheKeyBuilder.bandProfile(bandId),
 *   () => this.db.band.findUnique({ where: { id: bandId } }),
 *   CACHE_TTL.BAND_PROFILE
 * );
 * ```
 */
@Injectable()
export class CacheStrategyService {
  private readonly logger = new Logger(CacheStrategyService.name);
  private readonly metrics = new Map<string, { hits: number; misses: number }>();

  constructor(
    private readonly cache: CacheService,
    private readonly compression: CacheCompressionService,
  ) {}

  /**
   * Generic cache wrapper with compression support
   * This is the main method you'll use throughout the app
   * 
   * @param key - Cache key (use CacheKeyBuilder for consistency)
   * @param fetcher - Function that fetches fresh data
   * @param ttl - Time to live in seconds
   * @param options - Additional options
   * @returns Cached or fresh data
   */
  async wrap<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    options: {
      compress?: boolean;
      skipCache?: boolean;
      namespace?: string;
    } = {},
  ): Promise<T> {
    const { compress = true, skipCache = false } = options;

    // Skip cache if requested (useful for admin operations)
    if (skipCache) {
      return fetcher();
    }

    try {
      // Try to get from cache
      const cached = await this.get<T>(key, compress);
      if (cached !== null) {
        this.recordHit(key);
        this.logger.debug(`Cache HIT: ${key}`);
        return cached;
      }

      // Cache miss - fetch fresh data
      this.recordMiss(key);
      this.logger.debug(`Cache MISS: ${key}`);
      const fresh = await fetcher();

      // Store in cache (fire and forget - don't block response)
      this.set(key, fresh, ttl, compress).catch((err) => {
        this.logger.warn(`Failed to cache ${key}: ${err.message}`);
      });

      return fresh;
    } catch (error) {
      this.logger.error(`Cache error for ${key}:`, error);
      // On cache failure, fetch fresh data directly
      return fetcher();
    }
  }

  /**
   * Get from cache with automatic decompression
   */
  async get<T>(key: string, compressed = false): Promise<T | null> {
    try {
      const value = await this.cache.get<string>(key);
      if (!value) return null;

      // Decompress if needed
      const decompressed = compressed
        ? await this.compression.decompress(value)
        : value;

      return JSON.parse(decompressed) as T;
    } catch (error) {
      this.logger.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set in cache with automatic compression
   */
  async set(
    key: string,
    value: unknown,
    ttl: number,
    compress = true,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');

      // Compress if data is large enough
      const shouldCompress = compress && size > COMPRESSION_THRESHOLD;
      const toStore = shouldCompress
        ? await this.compression.compress(serialized)
        : serialized;

      await this.cache.set(key, toStore, ttl);

      if (shouldCompress) {
        const compressedSize = Buffer.byteLength(toStore, 'utf8');
        const reduction = Math.round((1 - compressedSize / size) * 100);
        this.logger.debug(
          `Compressed ${key}: ${size}B -> ${compressedSize}B (${reduction}% reduction)`,
        );
      }
    } catch (error) {
      this.logger.error(`Cache set error for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a single cache entry
   */
  async delete(key: string): Promise<void> {
    await this.cache.del(key);
    this.logger.debug(`Deleted cache key: ${key}`);
  }

  /**
   * Invalidate cache by pattern
   * Example: invalidatePattern('bands:*') removes all band caches
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const count = await this.cache.delPattern(pattern);
      this.logger.log(`Invalidated ${count} keys matching pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate multiple keys at once
   */
  async invalidateMultiple(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.cache.del(key)));
      this.logger.log(`Invalidated ${keys.length} cache keys`);
    } catch (error) {
      this.logger.error(`Failed to invalidate multiple keys:`, error);
    }
  }

  /**
   * Invalidate all caches for a specific band
   * Triggers: Band update, new video added to band, etc.
   */
  async invalidateBandCaches(bandId: string): Promise<void> {
    const patterns = [
      `bands:profile:${bandId}`,
      `bands:stats:${bandId}`,
      `bands:list:*`,
      `videos:list:band:${bandId}:*`,
      `videos:popular:band:${bandId}:*`,
      'popular:bands:*',
      'dashboard:stats',
    ];

    await Promise.all(patterns.map((p) => this.invalidatePattern(p)));
  }

  /**
   * Invalidate all caches for a specific video
   * Triggers: Video update, video deletion, video hidden/unhidden
   */
  async invalidateVideoCaches(videoId: string, bandId?: string, categoryId?: string): Promise<void> {
    const patterns = [
      `videos:detail:${videoId}`,
      'videos:list:*',
      'trending:videos:*',
      'dashboard:stats',
    ];

    if (bandId) {
      patterns.push(`videos:list:band:${bandId}:*`);
      patterns.push(`videos:popular:band:${bandId}:*`);
    }

    if (categoryId) {
      patterns.push(`videos:list:cat:${categoryId}:*`);
    }

    await Promise.all(patterns.map((p) => this.invalidatePattern(p)));
  }

  /**
   * Invalidate search caches
   * Triggers: New videos added, video metadata updated
   */
  async invalidateSearchCaches(): Promise<void> {
    await this.invalidatePattern('search:*');
  }

  /**
   * Invalidate user session caches
   * Triggers: Logout, password change, role change
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    const patterns = [
      `user:session:${userId}`,
      `user:preferences:${userId}`,
    ];

    await Promise.all(patterns.map((p) => this.delete(p)));
  }

  /**
   * Record cache hit for metrics
   */
  private recordHit(key: string): void {
    const namespace = this.extractNamespace(key);
    const metric = this.metrics.get(namespace) || { hits: 0, misses: 0 };
    metric.hits++;
    this.metrics.set(namespace, metric);
  }

  /**
   * Record cache miss for metrics
   */
  private recordMiss(key: string): void {
    const namespace = this.extractNamespace(key);
    const metric = this.metrics.get(namespace) || { hits: 0, misses: 0 };
    metric.misses++;
    this.metrics.set(namespace, metric);
  }

  /**
   * Extract namespace from cache key (e.g., "bands:profile:123" -> "bands")
   */
  private extractNamespace(key: string): string {
    return key.split(':')[0] || 'unknown';
  }

  /**
   * Get cache metrics for monitoring
   */
  async getMetrics(): Promise<CacheMetricsDto> {
    let totalHits = 0;
    let totalMisses = 0;
    const namespaceStats: CacheStats[] = [];

    // Aggregate metrics by namespace
    for (const [namespace, metric] of this.metrics.entries()) {
      totalHits += metric.hits;
      totalMisses += metric.misses;

      const total = metric.hits + metric.misses;
      if (total > 0) {
        namespaceStats.push({
          key: namespace,
          hits: metric.hits,
          misses: metric.misses,
          hitRate: metric.hits / total,
        });
      }
    }

    // Sort by most accessed
    namespaceStats.sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses));

    // Get Redis memory stats
    const memoryStats = await this.cache.getMemoryStats();
    const usedMemoryBytes = memoryStats
      ? parseInt(memoryStats.usedMemory?.replace(/[^\d]/g, '') || '0')
      : 0;

    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate,
      totalRequests: totalHits + totalMisses,
      usedMemoryBytes,
      usedMemoryMB: Math.round(usedMemoryBytes / 1024 / 1024),
      topKeys: namespaceStats.slice(0, 10),
    };
  }

  /**
   * Get detailed cache statistics from Redis
   */
  async getDetailedStats() {
    const metrics = await this.getMetrics();
    const memoryStats = await this.cache.getMemoryStats();
    const internalStats = this.cache.getStats();

    return {
      metrics,
      redis: memoryStats,
      internal: internalStats,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.cache.resetStats();
  }

  /**
   * Health check - verify cache is working
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testKey = 'health:check:test';
      const testValue = { timestamp: Date.now() };
      
      await this.cache.set(testKey, testValue, 10);
      const retrieved = await this.cache.get(testKey);
      await this.cache.del(testKey);
      
      return retrieved !== null;
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      return false;
    }
  }
}