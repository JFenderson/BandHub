/**
 * Enhanced cache key constants with granular patterns for better cache management
 * 
 * Key Naming Convention:
 * - Use colon (:) as separator for hierarchy
 * - Include relevant filters in key for precise cache hits
 * - Use wildcards (*) for pattern-based invalidation
 * 
 * Example: "videos:band:abc123:cat:xyz789:sort:publishedAt:desc:page:1:limit:20"
 */

export const CACHE_KEYS = {
  // ============================================================================
  // Band cache keys
  // ============================================================================
  BAND_LIST: 'bands:list',
  BAND_BY_SLUG: (slug: string) => `bands:slug:${slug}`,
  BAND_BY_ID: (id: string) => `bands:id:${id}`,
  BAND_STATS: 'bands:stats',
  BAND_BY_STATE: (state: string) => `bands:state:${state}`,
  BAND_BY_CONFERENCE: (conference: string) => `bands:conference:${conference}`,
  BAND_FEATURED: 'bands:featured',
  
  // ============================================================================
  // Video cache keys
  // ============================================================================
  VIDEO_LIST: 'videos:list',
  VIDEO_BY_ID: (id: string) => `videos:id:${id}`,
  VIDEO_POPULAR: 'videos:popular',
  VIDEO_RECENT: 'videos:recent',
  VIDEO_STATS: 'videos:stats',
  VIDEO_HIDDEN: 'videos:hidden',
  
  // Granular video list keys
  VIDEO_BY_BAND: (bandId: string) => `videos:band:${bandId}`,
  VIDEO_BY_CATEGORY: (categoryId: string) => `videos:cat:${categoryId}`,
  VIDEO_BY_BAND_CATEGORY: (bandId: string, categoryId: string) => 
    `videos:band:${bandId}:cat:${categoryId}`,
  VIDEO_POPULAR_BY_BAND: (bandId: string, limit: number = 10) => 
    `videos:popular:band:${bandId}:${limit}`,
  
  // ============================================================================
  // Category cache keys
  // ============================================================================
  CATEGORY_LIST: 'categories:list',
  CATEGORY_BY_SLUG: (slug: string) => `categories:slug:${slug}`,
  CATEGORY_BY_ID: (id: string) => `categories:id:${id}`,
  CATEGORY_WITH_COUNTS: 'categories:with-counts',
  
  // ============================================================================
  // Search cache keys
  // ============================================================================
  SEARCH_RESULTS: (query: string) => `search:${query.toLowerCase().trim()}`,
  SEARCH_SUGGESTIONS: (query: string) => `search:suggestions:${query.toLowerCase().trim()}`,
  SEARCH_POPULAR: 'search:popular',
  
  // ============================================================================
  // Creator cache keys
  // ============================================================================
  CREATOR_BY_ID: (id: string) => `creator:${id}`,
  CREATOR_FEATURED: 'creators:featured',
  CREATOR_BY_CHANNEL: (channelId: string) => `creator:channel:${channelId}`,
  
  // ============================================================================
  // YouTube video cache keys
  // ============================================================================
  YOUTUBE_VIDEO_BY_ID: (id: string) => `youtube:video:${id}`,
  YOUTUBE_VIDEO_BY_YOUTUBE_ID: (youtubeId: string) => `youtube:video:yt:${youtubeId}`,
  YOUTUBE_VIDEOS_BY_BAND: (bandId: string) => `youtube:videos:band:${bandId}`,
  YOUTUBE_VIDEOS_BY_CHANNEL: (channelId: string) => `youtube:videos:channel:${channelId}`,
  YOUTUBE_VIDEOS_NEEDING_SYNC: (channelId: string) => `youtube:needsync:${channelId}`,
  
  // ============================================================================
  // Sync job cache keys
  // ============================================================================
  SYNC_JOB_BY_ID: (id: string) => `syncjob:${id}`,
  SYNC_JOBS_ACTIVE: 'syncjobs:active',
  SYNC_JOBS_BY_BAND: (bandId: string) => `syncjobs:band:${bandId}`,
  SYNC_JOBS_BY_STATUS: (status: string) => `syncjobs:status:${status}`,
  
  // ============================================================================
  // Event cache keys
  // ============================================================================
  EVENT_BY_ID: (id: string) => `event:${id}`,
  EVENT_BY_SLUG: (slug: string) => `event:slug:${slug}`,
  EVENTS_ACTIVE: 'events:active',
  EVENTS_BY_YEAR: (year: number) => `events:year:${year}`,
  EVENTS_BY_TYPE: (type: string) => `events:type:${type}`,
  
  // ============================================================================
  // User cache keys (for authenticated features)
  // ============================================================================
  USER_BY_ID: (id: string) => `user:${id}`,
  USER_FAVORITES: (userId: string) => `user:${userId}:favorites`,
  USER_WATCH_LATER: (userId: string) => `user:${userId}:watchlater`,
  USER_FAVORITE_BANDS: (userId: string) => `user:${userId}:bands`,
  
  // ============================================================================
  // Admin cache keys
  // ============================================================================
  ADMIN_STATS: 'admin:stats',
  ADMIN_AUDIT_LOGS: (adminId: string) => `admin:${adminId}:audits`,
  ADMIN_RECENT_ACTIONS: 'admin:recent-actions',
} as const;

/**
 * Cache TTL (Time To Live) values in seconds
 * 
 * Guidelines:
 * - SHORT: Frequently changing data (user actions, live stats)
 * - MEDIUM: Moderately changing data (video lists, search results)
 * - LONG: Rarely changing data (band info, categories)
 * - DAY: Nearly static data (stats, aggregations)
 */
export const CACHE_TTL = {
  SHORT: 60,        // 1 minute - Live data
  MEDIUM: 300,      // 5 minutes - Video lists, search results
  LONG: 3600,       // 1 hour - Band info, categories
  DAY: 86400,       // 24 hours - Stats, aggregations
  WEEK: 604800,     // 7 days - Very static data
} as const;

/**
 * Cache invalidation patterns
 * Use these with cacheService.delPattern() for bulk invalidation
 */
export const CACHE_PATTERNS = {
  // Invalidate all video caches
  ALL_VIDEOS: 'videos:*',
  
  // Invalidate all video lists (keeps individual video details)
  VIDEO_LISTS: 'videos:*:page:*',
  
  // Invalidate all videos for a specific band
  BAND_VIDEOS: (bandId: string) => `videos:*band:${bandId}*`,
  
  // Invalidate all videos for a specific category
  CATEGORY_VIDEOS: (categoryId: string) => `videos:*cat:${categoryId}*`,
  
  // Invalidate all search results
  ALL_SEARCHES: 'search:*',
  
  // Invalidate all band caches
  ALL_BANDS: 'bands:*',
  
  // Invalidate all YouTube video caches
  ALL_YOUTUBE_VIDEOS: 'youtube:*',
  
  // Invalidate all caches for a specific channel
  CHANNEL_VIDEOS: (channelId: string) => `youtube:*channel:${channelId}*`,
  
  // Invalidate all sync job caches
  ALL_SYNC_JOBS: 'syncjobs:*',
  
  // Invalidate user-specific caches
  USER_ALL: (userId: string) => `user:${userId}:*`,
} as const;

/**
 * Helper function to build complex cache keys
 * Ensures consistent key format across the application
 */
export function buildCacheKey(parts: Record<string, string | number | boolean | undefined>): string {
  const keyParts: string[] = [];
  
  for (const [key, value] of Object.entries(parts)) {
    if (value !== undefined && value !== null) {
      keyParts.push(`${key}:${value}`);
    }
  }
  
  return keyParts.join(':');
}

/**
 * Example usage of buildCacheKey:
 * 
 * const key = buildCacheKey({
 *   resource: 'videos',
 *   band: bandId,
 *   category: categoryId,
 *   sort: 'publishedAt',
 *   order: 'desc',
 *   page: 1,
 *   limit: 20,
 * });
 * 
 * Result: "resource:videos:band:abc123:category:xyz789:sort:publishedAt:order:desc:page:1:limit:20"
 */