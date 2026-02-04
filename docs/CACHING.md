# Caching Guide

Comprehensive caching strategy and implementation for the HBCU Band Hub platform.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Cache Warming](#cache-warming)
4. [Cache Tagging](#cache-tagging)
5. [Stale-While-Revalidate (SWR)](#stale-while-revalidate-swr)
6. [Common Patterns](#common-patterns)
7. [Configuration](#configuration)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Caching Stack

- **Redis**: Primary cache store
- **Cache Strategy Service**: High-level caching abstraction
- **Compression**: Automatic compression for large payloads
- **Tag-based Invalidation**: Granular cache control
- **SWR Pattern**: Always-fast responses with background updates

### Benefits

- **Performance**: 10-100x faster than database queries
- **Scalability**: Reduced database load
- **Availability**: Serves stale data during outages
- **UX**: Instant page loads, seamless updates

---

## Quick Start

### 1. Enable Cache Warming

```bash
# .env
CACHE_WARMING_ENABLED=true
```

### 2. Use SWR for High-Traffic Endpoints

```typescript
import { CacheStrategyService, CacheKeyBuilder, CACHE_TTL } from '@bandhub/cache';

async getBandProfile(bandId: string) {
  return this.cacheStrategy.wrapSWR(
    CacheKeyBuilder.bandProfile(bandId),
    () => this.prisma.band.findUnique({ where: { id: bandId } }),
    CACHE_TTL.BAND_PROFILE,  // TTL: 1 hour
    300                       // Stale after: 5 minutes
  );
}
```

### 3. Use Tags for Invalidation

```typescript
// Store with tags
await this.cacheStrategy.setWithTags(
  CacheKeyBuilder.bandProfile(bandId),
  bandData,
  CACHE_TTL.BAND_PROFILE,
  [`band:${bandId}`, 'homepage', 'band-list']
);

// Invalidate by tag
await this.cacheStrategy.invalidateTag('homepage');
```

---

## Cache Warming

### What is Cache Warming?

Cache warming preloads critical data into the cache on application startup, ensuring:
- Fast cold starts
- Consistent performance
- Reduced database load on deployment

### Configuration

```bash
# .env
CACHE_WARMING_ENABLED=true  # Enable/disable warming (default: true)
```

### Warming Methods

#### 1. Popular Bands
```typescript
async warmPopularBands()
```

- Preloads top 20 bands by video count
- Caches individual band profiles
- Execution time: ~200-500ms

#### 2. Featured Videos
```typescript
async warmFeaturedVideos()
```

- Preloads 12 featured videos for homepage
- Includes relations (band, category, creator)
- Execution time: ~100-200ms

#### 3. Categories
```typescript
async warmCategories()
```

- Preloads all categories with video counts
- Execution time: ~50-100ms

#### 4. Trending Content
```typescript
async warmTrendingContent()
```

- Preloads top 50 trending videos (last 30 days)
- Uses view count and recency algorithm
- Execution time: ~150-300ms

### Scheduling

```typescript
@Cron(CronExpression.EVERY_6_HOURS)
async scheduledWarmup()
```

- Runs automatically every 6 hours
- Warms: popular bands, featured videos, trending content
- Non-blocking with error recovery

### Startup Behavior

```typescript
async onModuleInit()
```

- Runs on application startup
- Warms critical data in parallel
- Logs progress and timing

### Usage Example

```typescript
// Disable in development
CACHE_WARMING_ENABLED=false

// Manual trigger
await cacheWarmingService.warmPopularBands();

// Warm specific band
await cacheWarmingService.warmBand(bandId);

// Full warming (use sparingly)
await cacheWarmingService.warmAll();
```

---

## Cache Tagging

### What are Cache Tags?

Tags allow grouping cache keys for efficient batch invalidation:
- Invalidate all band-related caches: `band:${bandId}`
- Invalidate homepage caches: `homepage`
- Invalidate list caches: `band-list`

### Core Operations

#### Set with Tags
```typescript
await cacheTaggingService.setWithTags(
  key,
  value,
  ttl,
  ['band:123', 'homepage', 'band-list']
);
```

#### Invalidate by Tag
```typescript
// Single tag
await cacheTaggingService.invalidateByTag('homepage');

// Multiple tags
await cacheTaggingService.invalidateByTags(['band:123', 'homepage']);
```

#### Get Keys by Tag
```typescript
const keys = await cacheTaggingService.getKeysByTag('homepage');
// Returns: ['bands:featured', 'videos:homepage', ...]
```

### Tag Naming Conventions

```typescript
// Entity tags (specific item)
`band:${bandId}`          // All caches for this band
`video:${videoId}`        // All caches for this video
`category:${categoryId}`  // All caches for this category
`user:${userId}`          // All caches for this user

// List tags (collections)
'band-list'       // All band list caches
'video-list'      // All video list caches
'category-list'   // All category list caches

// Feature tags (by location)
'homepage'        // Homepage-related caches
'featured'        // Featured content caches
'trending'        // Trending content caches
'search-results'  // Search result caches

// Composite tags
`band:${bandId}:videos`          // Videos for specific band
`category:${categoryId}:videos`  // Videos in specific category
```

### Tag Statistics

```typescript
const tagStats = await cacheTaggingService.getTagStats();
/*
[
  { tagName: 'homepage', keyCount: 12 },
  { tagName: 'band:123', keyCount: 5 },
  { tagName: 'band-list', keyCount: 8 }
]
*/
```

---

## Stale-While-Revalidate (SWR)

### What is SWR?

SWR ensures always-fast responses by:
1. Returning cached data immediately (even if stale)
2. Revalidating in the background
3. Updating cache for next request

### Timeline

```
0───────────────staleTime───────────────ttl
│                 │                      │
│   FRESH         │      STALE          │  EXPIRED  │
│                 │                      │           │
│  Return cache   │  Return + BG update  │   Fetch   │
│  immediately    │  (next request fast) │   fresh   │
```

### States

1. **FRESH** (0 to staleTime)
   - Returns cached data immediately
   - No revalidation
   - Best performance

2. **STALE** (staleTime to ttl)
   - Returns cached data immediately
   - Triggers background revalidation
   - Next request gets fresh data

3. **EXPIRED** (> ttl)
   - Fetches fresh data synchronously
   - Blocks until data available
   - Updates cache

### Usage

```typescript
// Basic SWR
await cacheStrategy.wrapSWR(
  key,
  async () => {
    // Expensive database query
    return await prisma.band.findUnique({ where: { id } });
  },
  3600,  // TTL: 1 hour (expires completely)
  300    // Stale after: 5 minutes (triggers background update)
);
```

### Deduplication

SWR automatically deduplicates concurrent revalidations:
- Multiple requests during revalidation share the same update
- Prevents duplicate database queries
- Reduces load during traffic spikes

### Metrics

```typescript
const metrics = cacheStrategy.getSWRMetrics();
/*
{
  hits: 1250,           // Fresh cache hits
  staleHits: 342,       // Stale data served
  misses: 89,           // Cache misses
  revalidations: 267,   // Background updates
  errors: 3             // Revalidation failures
}
*/
```

### Best Use Cases

1. **High-Traffic Endpoints**
   - Band profiles
   - Video listings
   - Homepage content

2. **Frequently Updated Data**
   - View counts
   - Popular videos
   - Trending content

3. **Expensive Queries**
   - Complex aggregations
   - Multi-table joins
   - External API calls

---

## Common Patterns

### Pattern 1: High-Traffic Read Endpoint

```typescript
@Get(':id')
async getBand(@Param('id') id: string) {
  // SWR: Always fast, updates in background
  return this.cacheStrategy.wrapSWR(
    CacheKeyBuilder.bandProfile(id),
    () => this.bandsService.findOne(id),
    3600,  // 1 hour TTL
    300    // 5 min stale
  );
}
```

### Pattern 2: Update Endpoint with Tag Invalidation

```typescript
@Patch(':id')
async updateBand(@Param('id') id: string, @Body() data: UpdateBandDto) {
  const band = await this.bandsService.update(id, data);
  
  // Invalidate all related caches using tags
  await this.cacheStrategy.invalidateBandCachesWithTags(id);
  
  return band;
}
```

### Pattern 3: List Endpoint with Multiple Tags

```typescript
@Get()
async getBands(@Query() filters: BandFilterDto) {
  const key = CacheKeyBuilder.bandList(filters);
  
  // Try cache first
  const cached = await this.cacheStrategy.get(key);
  if (cached) return cached;
  
  // Fetch and cache with tags
  const bands = await this.bandsService.findAll(filters);
  await this.cacheStrategy.setWithTags(
    key,
    bands,
    CACHE_TTL.BAND_LIST,
    ['band-list', 'homepage']  // Multiple tags
  );
  
  return bands;
}
```

### Pattern 4: Homepage Aggregation

```typescript
@Get('homepage')
async getHomepageData() {
  // Multiple SWR calls in parallel
  const [featured, trending, popularBands] = await Promise.all([
    this.cacheStrategy.wrapSWR(
      'homepage:featured',
      () => this.getFeaturedVideos(),
      3600, 300
    ),
    this.cacheStrategy.wrapSWR(
      'homepage:trending',
      () => this.getTrendingVideos(),
      3600, 300
    ),
    this.cacheStrategy.wrapSWR(
      'homepage:bands',
      () => this.getPopularBands(),
      3600, 300
    ),
  ]);
  
  return { featured, trending, popularBands };
}
```

---

## Configuration

### TTL Constants

```typescript
export const CACHE_TTL = {
  BAND_PROFILE: 3600,        // 1 hour
  BAND_LIST: 1800,           // 30 minutes
  VIDEO_DETAIL: 1800,        // 30 minutes
  VIDEO_LIST: 900,           // 15 minutes
  FEATURED_VIDEOS: 1800,     // 30 minutes
  TRENDING_VIDEOS: 3600,     // 1 hour
  CATEGORIES: 7200,          // 2 hours (rarely changes)
  POPULAR_BANDS: 3600,       // 1 hour
  SEARCH_RESULTS: 900,       // 15 minutes
  HOMEPAGE: 1800,            // 30 minutes
};
```

### TTL & Stale Time Guidelines

```typescript
// Frequently changing data
TTL: 900 (15 min), Stale: 180 (3 min)

// Moderate changes
TTL: 1800 (30 min), Stale: 300 (5 min)

// Rarely changes
TTL: 3600 (1 hour), Stale: 600 (10 min)

// Almost static
TTL: 7200 (2 hours), Stale: 1800 (30 min)
```

### Compression

Automatic compression for payloads > 1KB:
- Uses gzip compression
- Transparent compression/decompression
- Reduces memory usage by ~70%

```typescript
// Compression is automatic
await cacheStrategy.set(key, largeData, ttl); // Auto-compressed if > 1KB
```

---

## Monitoring

### Cache Metrics

```typescript
const metrics = await cacheStrategy.getMetrics();

console.log(`Hit rate: ${metrics.hitRate.toFixed(2)}%`);
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Hits: ${metrics.hits}`);
console.log(`Misses: ${metrics.misses}`);
console.log(`Memory: ${metrics.usedMemoryMB}MB`);
console.log(`Keys: ${metrics.keyCount}`);
```

### SWR Metrics

```typescript
const swr = cacheStrategy.getSWRMetrics();

console.log(`Fresh hits: ${swr.hits}`);
console.log(`Stale hits: ${swr.staleHits}`);
console.log(`Revalidations: ${swr.revalidations}`);
console.log(`Errors: ${swr.errors}`);
console.log(`Active revalidations: ${cacheStrategy.getRevalidationQueueSize()}`);
```

### Tag Statistics

```typescript
const tagStats = await taggingService.getTagStats();
console.table(tagStats);
/*
┌─────────┬─────────────┬──────────┐
│ (index) │  tagName    │ keyCount │
├─────────┼─────────────┼──────────┤
│    0    │ 'homepage'  │    12    │
│    1    │ 'band:123'  │     5    │
│    2    │ 'band-list' │     8    │
└─────────┴─────────────┴──────────┘
*/
```

### Health Check

```typescript
const healthy = await cacheStrategy.healthCheck();
// Returns true if Redis is connected
```

### Prometheus Metrics

```promql
# Cache hit rate
rate(cache_hits_total[5m]) / rate(cache_requests_total[5m])

# SWR stale hits
rate(cache_stale_hits_total[5m])

# Revalidation errors
rate(cache_revalidation_errors_total[5m])

# Cache memory usage
redis_memory_bytes
```

---

## Troubleshooting

### Cache Warming is Slow

**Solution:** Disable during development
```bash
CACHE_WARMING_ENABLED=false
```

Or reduce warming scope:
```typescript
const popularBands = await this.prisma.band.findMany({
  take: 10, // Reduced from 20
  orderBy: { videos: { _count: 'desc' } }
});
```

### Stale Data Shown Too Long

**Solution:** Reduce stale time
```typescript
// Before (stale for 10 minutes)
wrapSWR(key, fetcher, 3600, 600)

// After (stale for 3 minutes)
wrapSWR(key, fetcher, 3600, 180)
```

### Too Many Cache Misses

**Solution:** Increase TTL or use SWR
```typescript
// Longer TTL
wrapSWR(key, fetcher, 7200, 600) // 2 hours instead of 1

// Or use standard caching instead of SWR
wrap(key, fetcher, 7200)
```

### High Memory Usage

**Solution:** Reduce TTL or warming scope
```typescript
// Shorter TTL
CACHE_TTL.BAND_PROFILE / 2  // 30 minutes instead of 1 hour

// Fewer warmed items
take: 10, // instead of 20
```

### Orphaned Tags

**Solution:** Run cleanup periodically
```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async cleanupTags() {
  await this.taggingService.cleanupOrphanedTags();
}
```

---

## API Reference

### CacheStrategyService

```typescript
// Standard caching
wrap<T>(key, fetcher, ttl, options?)
get<T>(key, compress?)
set(key, value, ttl, compress?)
delete(key)

// SWR pattern
wrapSWR<T>(key, fetcher, ttl, staleTime)
getSWRMetrics()
getRevalidationQueueSize()

// Tag-based
setWithTags(key, value, ttl, tags, compress?)
invalidateTag(tag)
invalidateTags(tags[])
getKeysByTag(tag)

// Convenience methods
invalidateBandCachesWithTags(bandId)
invalidateVideoCachesWithTags(videoId, bandId?, categoryId?)

// Metrics & Health
getMetrics()
getDetailedStats()
resetMetrics()
healthCheck()
```

### CacheTaggingService

```typescript
setWithTags(key, value, ttl, tags[])
invalidateByTag(tagName)
invalidateByTags(tagNames[])
addTagToKey(key, tags)
getKeysByTag(tagName)
getTagsForKey(key)
getAllTags()
getTagStats()
cleanupOrphanedTags()
```

### CacheWarmingService

```typescript
warmPopularBands()
warmFeaturedVideos()
warmCategories()
warmTrendingContent()
warmBand(bandId)
warmAll()
```

---

## Best Practices

1. **Always use SWR for high-traffic endpoints**
2. **Tag everything for easy invalidation**
3. **Warm critical data on startup**
4. **Monitor metrics regularly**
5. **Invalidate minimally (use specific tags)**
6. **Compress large payloads (automatic)**
7. **Use parallel caching for multiple items**

```typescript
// ✅ Good: Parallel caching
const [bands, videos, categories] = await Promise.all([
  this.cacheBands(),
  this.cacheVideos(),
  this.cacheCategories(),
]);

// ❌ Bad: Sequential caching
const bands = await this.cacheBands();
const videos = await this.cacheVideos();
const categories = await this.cacheCategories();
```

---

## Migration Checklist

- [ ] Enable cache warming: `CACHE_WARMING_ENABLED=true`
- [ ] Update high-traffic endpoints to use SWR
- [ ] Add tags to cache operations
- [ ] Replace pattern-based invalidation with tags
- [ ] Add monitoring dashboard queries
- [ ] Test cache warming performance
- [ ] Verify SWR behavior under load
- [ ] Document custom tags for your features
- [ ] Set up alerting on cache metrics
- [ ] Review and adjust TTL values
