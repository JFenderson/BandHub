import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheCompressionService } from './cache-compression.service';
import { CacheTaggingService } from './cache-tagging.service';
import { CacheMetricsDto, CacheStats } from './dto/cache-metrics.dto';

/**
 * SWR (Stale-While-Revalidate) metrics
 */
interface SWRMetrics {
  hits: number;           // Cache hits (fresh data)
  staleHits: number;      // Stale data served while revalidating
  misses: number;         // Cache misses (fetch fresh)
  revalidations: number;  // Background revalidations
  errors: number;         // Revalidation errors
}

/**
 * Cache entry metadata for SWR pattern
 */
interface CacheEntryMetadata {
  cachedAt: number;       // Timestamp when cached
  staleAt: number;        // Timestamp when data becomes stale
  expiresAt: number;      // Timestamp when data expires
}

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
  private readonly swrMetrics: SWRMetrics = {
    hits: 0,
    staleHits: 0,
    misses: 0,
    revalidations: 0,
    errors: 0,
  };
  
  // Track in-flight revalidation requests to prevent duplicate work
  private readonly revalidationQueue = new Map<string, Promise<any>>();

  constructor(
    private readonly cache: CacheService,
    private readonly compression: CacheCompressionService,
    private readonly tagging: CacheTaggingService,
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
    const raw = await this.cache.get<string>(key);
    if (!raw) return null;

    // Parse the envelope
    let envelope: { compressed: boolean; data: string };
    try {
      envelope = JSON.parse(raw);
    } catch {
      // Fallback: might be old format without envelope
      this.logger.warn(`Cache key ${key} has old format, will be migrated on next write`);
      return JSON.parse(raw) as T;
    }

    // Check if we need to decompress
    const data = envelope.compressed
      ? await this.compression.decompress(envelope.data)
      : envelope.data;

    return JSON.parse(data) as T;
  } catch (error) {
    this.logger.error(`Cache get error for ${key}:`, error);
    this.logger.debug(`Cache MISS: ${key}`);
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
    
    if (shouldCompress) {
      const compressed = await this.compression.compress(serialized);
      const compressedSize = Buffer.byteLength(compressed, 'utf8');
      const reduction = Math.round((1 - compressedSize / size) * 100);
      
      // Store with metadata indicating it's compressed
      const envelope = JSON.stringify({
        compressed: true,
        data: compressed,
      });
      
      await this.cache.set(key, envelope, ttl);
      
      this.logger.debug(
        `Compressed ${key}: ${size}B -> ${compressedSize}B (${reduction}% reduction)`,
      );
    } else {
      // Store uncompressed with metadata
      const envelope = JSON.stringify({
        compressed: false,
        data: serialized,
      });
      
      await this.cache.set(key, envelope, ttl);
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
      swr: this.swrMetrics, // Include SWR metrics
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
    
    // Reset SWR metrics
    this.swrMetrics.hits = 0;
    this.swrMetrics.staleHits = 0;
    this.swrMetrics.misses = 0;
    this.swrMetrics.revalidations = 0;
    this.swrMetrics.errors = 0;
  }

  /**
   * Stale-While-Revalidate (SWR) caching pattern
   * 
   * This provides the best of both worlds:
   * - Always returns data quickly (from cache if available)
   * - Keeps data fresh by revalidating in the background
   * - Handles high traffic by serving stale data while updating
   * 
   * Perfect for high-traffic endpoints like band profiles and video listings.
   * 
   * @param key - Cache key
   * @param fetcher - Function that fetches fresh data
   * @param ttl - Total time to live in seconds (max age before expiry)
   * @param staleTime - Time in seconds after which data is considered stale
   * @returns Cached or fresh data (immediately), revalidates in background if stale
   * 
   * Example:
   * ```ts
   * const bandProfile = await cacheStrategy.wrapSWR(
   *   'bands:profile:123',
   *   () => prisma.band.findUnique({ where: { id: '123' } }),
   *   3600,  // TTL: 1 hour
   *   300    // Stale after: 5 minutes
   * );
   * ```
   * 
   * Timeline:
   * - 0-300s: Fresh data, return immediately, no revalidation
   * - 300-3600s: Stale data, return immediately, revalidate in background
   * - >3600s: Expired, fetch fresh data synchronously
   */
  async wrapSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number,
  ): Promise<T> {
    try {
      const metadataKey = `${key}:metadata`;
      
      // Try to get cached data and metadata
      const [cachedData, metadata] = await Promise.all([
        this.get<T>(key, true),
        this.get<CacheEntryMetadata>(metadataKey, false),
      ]);

      const now = Date.now();

      // Case 1: Cache miss - fetch fresh data synchronously
      if (cachedData === null || metadata === null) {
        this.swrMetrics.misses++;
        this.recordMiss(key);
        this.logger.debug(`SWR MISS: ${key} - fetching fresh data`);
        
        const fresh = await fetcher();
        await this.setSWR(key, fresh, ttl, staleTime);
        return fresh;
      }

      // Case 2: Cache expired - fetch fresh data synchronously
      if (now > metadata.expiresAt) {
        this.swrMetrics.misses++;
        this.recordMiss(key);
        this.logger.debug(`SWR EXPIRED: ${key} - fetching fresh data`);
        
        const fresh = await fetcher();
        await this.setSWR(key, fresh, ttl, staleTime);
        return fresh;
      }

      // Case 3: Data is fresh - return immediately, no revalidation
      if (now < metadata.staleAt) {
        this.swrMetrics.hits++;
        this.recordHit(key);
        this.logger.debug(`SWR FRESH: ${key}`);
        return cachedData;
      }

      // Case 4: Data is stale - return immediately, revalidate in background
      this.swrMetrics.staleHits++;
      this.recordHit(key);
      this.logger.debug(`SWR STALE: ${key} - serving stale, revalidating in background`);
      
      // Trigger background revalidation (with deduplication)
      this.revalidateInBackground(key, fetcher, ttl, staleTime);
      
      return cachedData;
    } catch (error) {
      this.logger.error(`SWR error for ${key}:`, error);
      this.swrMetrics.errors++;
      
      // On error, try to fetch fresh data
      try {
        return await fetcher();
      } catch (fetchError) {
        this.logger.error(`SWR fetcher failed for ${key}:`, fetchError);
        throw fetchError;
      }
    }
  }

  /**
   * Set cache value with SWR metadata
   * Stores both the data and metadata about when it becomes stale
   */
  private async setSWR<T>(
    key: string,
    value: T,
    ttl: number,
    staleTime: number,
  ): Promise<void> {
    const now = Date.now();
    const metadata: CacheEntryMetadata = {
      cachedAt: now,
      staleAt: now + staleTime * 1000,
      expiresAt: now + ttl * 1000,
    };

    await Promise.all([
      this.set(key, value, ttl, true),
      this.set(`${key}:metadata`, metadata, ttl, false),
    ]);
  }

  /**
   * Revalidate cache in background with deduplication
   * Prevents multiple concurrent revalidations of the same key
   */
  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number,
  ): void {
    // Check if revalidation is already in progress
    if (this.revalidationQueue.has(key)) {
      this.logger.debug(`SWR: Revalidation already in progress for ${key}, skipping`);
      return;
    }

    // Start revalidation
    const revalidationPromise = this.executeRevalidation(key, fetcher, ttl, staleTime);
    this.revalidationQueue.set(key, revalidationPromise);

    // Clean up from queue when done
    revalidationPromise.finally(() => {
      this.revalidationQueue.delete(key);
    });
  }

  /**
   * Execute the actual revalidation
   */
  private async executeRevalidation<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number,
  ): Promise<void> {
    try {
      this.swrMetrics.revalidations++;
      this.logger.debug(`SWR: Revalidating ${key} in background`);
      
      const fresh = await fetcher();
      await this.setSWR(key, fresh, ttl, staleTime);
      
      this.logger.debug(`SWR: Successfully revalidated ${key}`);
    } catch (error) {
      this.swrMetrics.errors++;
      this.logger.error(`SWR: Revalidation failed for ${key}:`, error);
      // Don't throw - this is background work, stale data is still valid
    }
  }

  /**
   * Get SWR metrics for monitoring
   */
  getSWRMetrics(): SWRMetrics {
    return { ...this.swrMetrics };
  }

  /**
   * Check if a key is currently being revalidated
   */
  isRevalidating(key: string): boolean {
    return this.revalidationQueue.has(key);
  }

  /**
   * Get the number of in-flight revalidations
   */
  getRevalidationQueueSize(): number {
    return this.revalidationQueue.size;
  }

  /**
   * Set cache value with tags for granular invalidation
   * Combines compression and tagging
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   * @param tags - Array of tags for grouping related caches
   * @param compress - Whether to compress (default: true)
   */
  async setWithTags(
    key: string,
    value: unknown,
    ttl: number,
    tags: string[],
    compress = true,
  ): Promise<void> {
    // First set the value using standard compression logic
    await this.set(key, value, ttl, compress);
    
    // Then add tags
    await this.tagging.addTagToKey(key, tags);
  }

  /**
   * Invalidate all caches by tag
   * More granular than pattern-based invalidation
   * 
   * Example:
   * ```ts
   * // Invalidate all homepage-related caches
   * await cacheStrategy.invalidateTag('homepage');
   * 
   * // Invalidate all caches for a specific band
   * await cacheStrategy.invalidateTag('band:123');
   * ```
   */
  async invalidateTag(tag: string): Promise<number> {
    return this.tagging.invalidateByTag(tag);
  }

  /**
   * Invalidate multiple tags at once
   */
  async invalidateTags(tags: string[]): Promise<number> {
    return this.tagging.invalidateByTags(tags);
  }

  /**
   * Get all keys associated with a tag
   */
  async getKeysByTag(tag: string): Promise<string[]> {
    return this.tagging.getKeysByTag(tag);
  }

  /**
   * Invalidate all caches for a specific band (using tags)
   * More efficient than pattern-based invalidation
   */
  async invalidateBandCachesWithTags(bandId: string): Promise<void> {
    const tags = [
      `band:${bandId}`,
      'band-list',
      'homepage',
      'popular-bands',
    ];

    const count = await this.invalidateTags(tags);
    this.logger.log(`Invalidated ${count} band caches for band ${bandId} using tags`);
  }

  /**
   * Invalidate all caches for a specific video (using tags)
   */
  async invalidateVideoCachesWithTags(
    videoId: string,
    bandId?: string,
    categoryId?: string,
  ): Promise<void> {
    const tags = [
      `video:${videoId}`,
      'video-list',
      'trending-videos',
      'homepage',
    ];

    if (bandId) {
      tags.push(`band:${bandId}`);
    }

    if (categoryId) {
      tags.push(`category:${categoryId}`);
    }

    const count = await this.invalidateTags(tags);
    this.logger.log(`Invalidated ${count} video caches for video ${videoId} using tags`);
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