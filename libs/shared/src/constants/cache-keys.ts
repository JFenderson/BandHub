export const CACHE_KEYS = {
  // Band cache keys
  BAND_LIST: 'bands:list',
  BAND_BY_SLUG: (slug: string) => `bands:slug:${slug}`,
  BAND_BY_ID: (id: string) => `bands:id:${id}`,

  // Video cache keys
  VIDEO_LIST: 'videos:list',
  VIDEO_BY_ID: (id: string) => `videos:id:${id}`,
  VIDEO_POPULAR: 'videos:popular',
  VIDEO_RECENT: 'videos:recent',

  // Category cache keys
  CATEGORY_LIST: 'categories:list',

  // Search cache
  SEARCH_RESULTS: (query: string) => `search:${query}`,
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;