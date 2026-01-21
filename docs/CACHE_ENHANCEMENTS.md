# Cache Enhancement Implementation

## Overview

This document describes the comprehensive cache enhancements implemented for BandHub, including cache warming, tag-based invalidation, and Stale-While-Revalidate (SWR) caching pattern.

## 1. Cache Warming Service (`cache-warming.service.ts`)

### Features Implemented

#### Configuration
- **Environment Variable**: `CACHE_WARMING_ENABLED` (default: `true`)
  - Set to `false` to disable cache warming
  - Useful for development or during maintenance

#### Warming Methods

1. **`warmPopularBands()`**
   - Preloads top 20 bands by video count
   - Caches individual band profiles and the popular bands list
   - Progress logging every 5 bands
   - Execution time tracking

2. **`warmFeaturedVideos()`**
   - Preloads 12 featured videos for homepage carousel
   - Includes band, category, and content creator relations
   - Uses view count and recency for selection

3. **`warmCategories()`**
   - Preloads all categories with video counts
   - Logs total videos across all categories
   - Execution time tracking

4. **`warmTrendingContent()`**
   - Implements trending algorithm: recent videos (last 30 days) with high views
   - Preloads top 50 trending videos
   - Includes full relations for display

#### Scheduling

```typescript
@Cron(CronExpression.EVERY_6_HOURS)
async scheduledWarmup()
```

- Runs automatically every 6 hours
- Warms: popular bands, featured videos, trending content, popular videos by band
- Comprehensive error handling and logging

#### Startup Behavior

```typescript
async onModuleInit()
```

- Runs on application startup
- Warms critical data in parallel
- Non-blocking with error recovery

### Usage Example

```typescript
// Disable cache warming in development
// .env
CACHE_WARMING_ENABLED=false

// Manually trigger warming
await cacheWarmingService.warmPopularBands();

// Full cache warming (use sparingly)
await cacheWarmingService.warmAll();
```

## 2. Cache Tagging Service (`cache-tagging.service.ts`)

### Features Implemented

#### Core Interface

```typescript
interface CacheTag {
  name: string;
  keys: string[];
}
```

#### Key Methods

1. **`setWithTags(key, value, ttl, tags[])`**
   - Store cache value with associated tags
   - Tags stored in Redis Sets for efficient lookup
   - Automatic TTL management

2. **`invalidateByTag(tagName)`**
   - Clear all cache keys associated with a tag
   - Returns count of invalidated keys
   - Atomic operation

3. **`invalidateByTags(tagNames[])`**
   - Bulk invalidate multiple tags
   - More efficient than individual calls

4. **`addTagToKey(key, tags)`**
   - Add tags to existing cache entries
   - Preserves original TTL

5. **`getKeysByTag(tagName)`**
   - List all keys for a specific tag
   - Useful for debugging and monitoring

6. **`getAllTags()`**
   - Retrieve all available tags
   - Uses SCAN for efficient iteration

7. **`getTagStats()`**
   - Get statistics about tag usage
   - Returns tag name and key count
   - Sorted by most keys

8. **`cleanupOrphanedTags()`**
   - Remove tag entries for expired/deleted keys
   - Background maintenance task

### Tag Structure

- Tag keys: `tags:{tagName}` (Redis Set)
- Key tags: `tags:key:{cacheKey}` (JSON array)
- Relationship: Tag → Keys (one-to-many)

### Usage Examples

```typescript
// Store with tags
await taggingService.setWithTags(
  'bands:profile:123',
  bandData,
  3600,
  ['band:123', 'homepage', 'featured']
);

// Invalidate all homepage caches
await taggingService.invalidateByTag('homepage');

// Invalidate all band-related caches
await taggingService.invalidateByTag('band:123');

// Get statistics
const stats = await taggingService.getTagStats();
// [{ tag: 'homepage', keyCount: 45 }, ...]
```

### Recommended Tagging Strategy

#### Band-Related Caches
```typescript
tags: ['band:${bandId}', 'band-list', 'homepage']
```

#### Video-Related Caches
```typescript
tags: ['video:${videoId}', 'band:${bandId}', 'category:${categoryId}', 'video-list']
```

#### Homepage Content
```typescript
tags: ['homepage', 'featured', 'trending']
```

#### Category Content
```typescript
tags: ['category:${categoryId}', 'category-list']
```

## 3. SWR (Stale-While-Revalidate) Pattern (`cache-strategy.service.ts`)

### Concept

SWR provides the best user experience by:
1. Returning cached data immediately (if available)
2. Revalidating stale data in the background
3. Never blocking the response for cache updates

### Implementation

#### Method Signature

```typescript
async wrapSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,        // Total expiry time
  staleTime: number   // When data becomes stale
): Promise<T>
```

#### Timeline

```
0s ──────── staleTime ──────── ttl ──────── ∞

│   FRESH   │      STALE      │  EXPIRED  │
│           │                 │           │
│  Return   │  Return + BG    │   Fetch   │
│  cache    │  revalidate     │   fresh   │
```

#### States

1. **FRESH** (0 to staleTime)
   - Return cached data immediately
   - No revalidation needed
   - Best performance

2. **STALE** (staleTime to ttl)
   - Return cached data immediately
   - Trigger background revalidation
   - Next request gets fresh data

3. **EXPIRED** (> ttl)
   - Fetch fresh data synchronously
   - Block until data is available
   - Update cache

#### Deduplication

```typescript
private readonly revalidationQueue = new Map<string, Promise<any>>();
```

- Prevents duplicate revalidation requests
- Multiple concurrent requests share the same revalidation
- Reduces database load

#### Metrics

```typescript
interface SWRMetrics {
  hits: number;           // Fresh cache hits
  staleHits: number;      // Stale data served
  misses: number;         // Cache misses
  revalidations: number;  // Background updates
  errors: number;         // Revalidation failures
}
```

### Usage Examples

```typescript
// Band profile with SWR
const band = await cacheStrategy.wrapSWR(
  CacheKeyBuilder.bandProfile(bandId),
  () => prisma.band.findUnique({ where: { id: bandId } }),
  3600,  // TTL: 1 hour
  300    // Stale after: 5 minutes
);

// Video listing with SWR
const videos = await cacheStrategy.wrapSWR(
  CacheKeyBuilder.videoList({ bandId }),
  () => prisma.video.findMany({ where: { bandId } }),
  1800,  // TTL: 30 minutes
  180    // Stale after: 3 minutes
);

// Check SWR metrics
const metrics = cacheStrategy.getSWRMetrics();
console.log(`Hit rate: ${metrics.hits / (metrics.hits + metrics.misses)}`);
console.log(`Stale hits: ${metrics.staleHits}`);
console.log(`In-flight revalidations: ${cacheStrategy.getRevalidationQueueSize()}`);
```

### Best Use Cases

1. **High-Traffic Endpoints**
   - Band profiles
   - Video listings
   - Homepage content
   - Category pages

2. **Frequently Updated Data**
   - View counts
   - Popular videos
   - Trending content

3. **Expensive Queries**
   - Complex aggregations
   - Multi-table joins
   - External API calls

## 4. CacheStrategyService Integration

### New Methods for Tagging

```typescript
// Set with tags and compression
await cacheStrategy.setWithTags(key, value, ttl, ['tag1', 'tag2']);

// Invalidate by tag
await cacheStrategy.invalidateTag('homepage');
await cacheStrategy.invalidateTags(['band:123', 'homepage']);

// Get keys by tag
const keys = await cacheStrategy.getKeysByTag('homepage');

// Convenient invalidation methods
await cacheStrategy.invalidateBandCachesWithTags(bandId);
await cacheStrategy.invalidateVideoCachesWithTags(videoId, bandId, categoryId);
```

### Enhanced Metrics

```typescript
const metrics = await cacheStrategy.getMetrics();

// Standard metrics
console.log(`Hit rate: ${metrics.hitRate}`);
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Memory used: ${metrics.usedMemoryMB}MB`);

// SWR metrics
console.log(`Fresh hits: ${metrics.swr.hits}`);
console.log(`Stale hits: ${metrics.swr.staleHits}`);
console.log(`Background revalidations: ${metrics.swr.revalidations}`);
```

## 5. Module Configuration

### Updated `cache.module.ts`

```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CacheService,
    CacheCompressionService,
    CacheTaggingService,        // NEW
    CacheStrategyService,
    CacheWarmingService,
  ],
  exports: [
    CacheService,
    CacheStrategyService,
    CacheCompressionService,
    CacheWarmingService,
    CacheTaggingService,         // NEW
  ],
})
export class CacheModule {}
```

### Updated `index.ts`

All services are now exported and available for import:

```typescript
import {
  CacheService,
  CacheStrategyService,
  CacheTaggingService,
  CacheWarmingService,
  CacheKeyBuilder,
  CACHE_TTL,
} from '@bandhub/cache';
```

## 6. Recommended Migration Strategy

### Phase 1: Enable Cache Warming
```bash
# .env
CACHE_WARMING_ENABLED=true
```

Deploy and monitor startup performance and cache hit rates.

### Phase 2: Add Tags to High-Impact Endpoints

```typescript
// Example: Band controller
async getBandProfile(bandId: string) {
  return this.cacheStrategy.wrap(
    CacheKeyBuilder.bandProfile(bandId),
    () => this.prisma.band.findUnique({ where: { id: bandId } }),
    CACHE_TTL.BAND_PROFILE
  );
}

// Migrate to tagged version
async getBandProfile(bandId: string) {
  const key = CacheKeyBuilder.bandProfile(bandId);
  const cached = await this.cacheStrategy.get(key);
  if (cached) return cached;
  
  const band = await this.prisma.band.findUnique({ where: { id: bandId } });
  await this.cacheStrategy.setWithTags(
    key,
    band,
    CACHE_TTL.BAND_PROFILE,
    [`band:${bandId}`, 'band-list', 'homepage']
  );
  return band;
}
```

### Phase 3: Migrate to SWR for High-Traffic Endpoints

```typescript
// Before
async getBandProfile(bandId: string) {
  return this.cacheStrategy.wrap(
    CacheKeyBuilder.bandProfile(bandId),
    () => this.prisma.band.findUnique({ where: { id: bandId } }),
    CACHE_TTL.BAND_PROFILE
  );
}

// After
async getBandProfile(bandId: string) {
  return this.cacheStrategy.wrapSWR(
    CacheKeyBuilder.bandProfile(bandId),
    () => this.prisma.band.findUnique({ where: { id: bandId } }),
    CACHE_TTL.BAND_PROFILE,  // 1 hour total
    300                       // 5 minutes stale time
  );
}
```

### Phase 4: Use Tag-Based Invalidation

```typescript
// Before (pattern-based)
async updateBand(bandId: string, data: UpdateBandDto) {
  const band = await this.prisma.band.update({ where: { id: bandId }, data });
  await this.cacheStrategy.invalidateBandCaches(bandId);
  return band;
}

// After (tag-based)
async updateBand(bandId: string, data: UpdateBandDto) {
  const band = await this.prisma.band.update({ where: { id: bandId }, data });
  await this.cacheStrategy.invalidateBandCachesWithTags(bandId);
  return band;
}
```

## 7. Monitoring and Observability

### Key Metrics to Monitor

1. **Cache Warming**
   - Startup time impact
   - Warming duration
   - Number of keys warmed

2. **SWR Performance**
   - Fresh hit rate
   - Stale hit rate
   - Revalidation success rate
   - Average revalidation time

3. **Tag Usage**
   - Number of tags
   - Keys per tag
   - Invalidation frequency

### Logging

All services provide detailed logging:

```
🔥 Starting cache warming on startup...
⏳ Warming popular bands...
  Progress: 5/20 popular bands warmed
  Progress: 10/20 popular bands warmed
✅ Warmed 20 popular band profiles in 245ms
⏳ Warming featured videos...
✅ Warmed 12 featured videos in 89ms
✅ Cache warming on startup complete in 892ms
```

### Health Checks

```typescript
// Cache health
const healthy = await cacheStrategy.healthCheck();

// Detailed stats
const stats = await cacheStrategy.getDetailedStats();

// Tag statistics
const tagStats = await taggingService.getTagStats();

// SWR metrics
const swrMetrics = cacheStrategy.getSWRMetrics();
```

## 8. Performance Considerations

### Memory Usage

- Cache warming increases initial memory footprint
- Monitor Redis memory usage
- Consider adjusting warming limits for large datasets

### TTL Configuration

Recommended TTL values:
- Fresh data (SWR): 5-10 minutes
- Total TTL: 30-60 minutes
- Category data: 2 hours (rarely changes)
- Trending data: 1 hour (updates frequently)

### Revalidation Load

- SWR revalidations happen in background
- Multiple concurrent requests are deduplicated
- Failed revalidations don't affect user experience

## 9. Troubleshooting

### Cache warming takes too long

```typescript
// Reduce warming scope
CACHE_WARMING_ENABLED=false

// Or reduce number of items
const popularBands = await this.prisma.band.findMany({
  take: 10, // Reduced from 20
  // ...
});
```

### High revalidation rate

```typescript
// Increase stale time
await cacheStrategy.wrapSWR(key, fetcher, 3600, 600); // 10 min stale instead of 5
```

### Tag cleanup needed

```typescript
// Schedule periodic cleanup
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async cleanupTags() {
  await this.taggingService.cleanupOrphanedTags();
}
```

## 10. Future Enhancements

1. **Cache warming priority queue**
   - Warm most critical data first
   - Progressive warming based on traffic patterns

2. **Dynamic stale time**
   - Adjust stale time based on update frequency
   - Machine learning for optimal timing

3. **Distributed cache warming**
   - Coordinate warming across multiple instances
   - Prevent duplicate work

4. **Tag hierarchy**
   - Parent-child tag relationships
   - Cascade invalidation

5. **Cache analytics dashboard**
   - Real-time metrics visualization
   - Performance insights
   - Optimization recommendations

## Summary

The enhanced caching system provides:

✅ **Comprehensive cache warming** - Fast cold starts with configurable warming
✅ **Tag-based invalidation** - Granular control over cache invalidation
✅ **SWR pattern** - Optimal user experience with background updates
✅ **Monitoring & metrics** - Full observability into cache performance
✅ **Production-ready** - Error handling, logging, and health checks

These improvements will significantly enhance application performance, reduce database load, and provide a better user experience.
