# Cache Enhancement Quick Reference

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

### 3. Use Tags for Easy Invalidation

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

## Recommended Tag Naming

```typescript
// Entity tags (specific item)
`band:${bandId}`
`video:${videoId}`
`category:${categoryId}`
`user:${userId}`

// List tags (collections)
'band-list'
'video-list'
'category-list'

// Feature tags (by location)
'homepage'
'featured'
'trending'
'search-results'

// Composite tags
`band:${bandId}:videos`
`category:${categoryId}:videos`
```

## TTL & Stale Time Guidelines

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

## Invalidation Strategies

### Option 1: Tag-Based (Recommended)

```typescript
// Update triggers invalidation
async updateBand(id: string, data: UpdateBandDto) {
  const band = await this.prisma.band.update({ where: { id }, data });
  await this.cacheStrategy.invalidateTags([
    `band:${id}`,
    'band-list',
    'homepage',
  ]);
  return band;
}
```

### Option 2: Pattern-Based (Legacy)

```typescript
await this.cacheStrategy.invalidatePattern('bands:*');
```

### Option 3: Specific Keys

```typescript
await this.cacheStrategy.delete(CacheKeyBuilder.bandProfile(id));
```

## Monitoring

```typescript
// Get cache metrics
const metrics = await this.cacheStrategy.getMetrics();

console.log(`Hit rate: ${metrics.hitRate.toFixed(2)}`);
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Memory: ${metrics.usedMemoryMB}MB`);

// SWR specific
const swr = this.cacheStrategy.getSWRMetrics();
console.log(`Fresh hits: ${swr.hits}`);
console.log(`Stale hits: ${swr.staleHits}`);
console.log(`Revalidations: ${swr.revalidations}`);
console.log(`Active revalidations: ${this.cacheStrategy.getRevalidationQueueSize()}`);

// Tag statistics
const tagStats = await this.taggingService.getTagStats();
console.table(tagStats);
```

## Common Issues & Solutions

### Issue: Cache warming is slow
**Solution:** Disable during development
```bash
CACHE_WARMING_ENABLED=false
```

### Issue: Stale data shown too long
**Solution:** Reduce stale time
```typescript
wrapSWR(key, fetcher, 3600, 180) // 3 min instead of 5
```

### Issue: Too many cache misses
**Solution:** Increase TTL or use SWR
```typescript
wrapSWR(key, fetcher, 7200, 600) // Longer TTL
```

### Issue: Memory usage high
**Solution:** Reduce warming scope or TTLs
```typescript
// Reduce cached items
take: 10, // instead of 20

// Or shorter TTL
CACHE_TTL.BAND_PROFILE / 2
```

## Performance Tips

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

## Testing

```typescript
// Reset cache in tests
beforeEach(async () => {
  await cacheStrategy.resetMetrics();
});

// Verify caching
it('should cache band profile', async () => {
  const band = await service.getBand(bandId);
  const metrics = await cacheStrategy.getMetrics();
  expect(metrics.misses).toBe(1);
  
  await service.getBand(bandId); // Second call
  const metrics2 = await cacheStrategy.getMetrics();
  expect(metrics2.hits).toBe(1);
});

// Verify invalidation
it('should invalidate on update', async () => {
  await service.getBand(bandId);
  await service.updateBand(bandId, data);
  
  const keys = await tagging.getKeysByTag(`band:${bandId}`);
  expect(keys).toHaveLength(0); // All invalidated
});
```

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

// Convenience
invalidateBandCachesWithTags(bandId)
invalidateVideoCachesWithTags(videoId, bandId?, categoryId?)

// Metrics
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
