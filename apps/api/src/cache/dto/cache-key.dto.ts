/**
 * Cache key builder utilities
 * Provides consistent naming for cache keys across the application
 * 
 * Key structure: {namespace}:{entity}:{id}:{suffix}
 * Example: "bands:profile:abc123" or "videos:list:band:xyz:page:1"
 * 
 * Benefits:
 * - Prevents key collisions
 * - Makes invalidation easier with patterns
 * - Human-readable for debugging
 */
export class CacheKeyBuilder {
  // ============ BAND KEYS ============
  
  /**
   * Key for individual band profile
   * Invalidation triggers: Band update
   */
  static bandProfile(bandId: string): string {
    return `bands:profile:${bandId}`;
  }

  /**
   * Key for band list with filters
   * Invalidation triggers: Band created/updated/deleted
   */
  static bandList(filters?: {
    search?: string;
    state?: string;
    page?: number;
    limit?: number;
  }): string {
    if (!filters) return 'bands:list:all';
    
    const parts = ['bands', 'list'];
    if (filters.search) parts.push(`search:${this.sanitize(filters.search)}`);
    if (filters.state) parts.push(`state:${filters.state}`);
    if (filters.page) parts.push(`page:${filters.page}`);
    if (filters.limit) parts.push(`limit:${filters.limit}`);
    
    return parts.join(':');
  }

  /**
   * Key for band statistics
   * Invalidation triggers: Video added/removed from band
   */
  static bandStats(bandId: string): string {
    return `bands:stats:${bandId}`;
  }

  // ============ VIDEO KEYS ============
  
  /**
   * Key for individual video detail
   * Invalidation triggers: Video update
   */
  static videoDetail(videoId: string): string {
    return `videos:detail:${videoId}`;
  }

  /**
   * Key for video list with filters
   * Invalidation triggers: Video created/updated/deleted
   */
  static videoList(filters?: {
    bandId?: string;
    categoryId?: string;
    creatorId?: string;
    year?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): string {
    if (!filters) return 'videos:list:all';
    
    const parts = ['videos', 'list'];
    if (filters.bandId) parts.push(`band:${filters.bandId}`);
    if (filters.categoryId) parts.push(`cat:${filters.categoryId}`);
    if (filters.creatorId) parts.push(`creator:${filters.creatorId}`);
    if (filters.year) parts.push(`year:${filters.year}`);
    if (filters.sortBy) parts.push(`sort:${filters.sortBy}`);
    if (filters.sortOrder) parts.push(`order:${filters.sortOrder}`);
    if (filters.page) parts.push(`page:${filters.page}`);
    if (filters.limit) parts.push(`limit:${filters.limit}`);
    
    return parts.join(':');
  }

  /**
   * Key for popular videos by band
   * Invalidation triggers: Video views updated, new videos added
   */
  static popularVideosByBand(bandId: string, limit: number): string {
    return `videos:popular:band:${bandId}:${limit}`;
  }

  // ============ SEARCH KEYS ============
  
  /**
   * Key for search results
   * Invalidation triggers: New content added, content updated
   */
  static searchResults(query: string, filters?: Record<string, any>): string {
    const sanitizedQuery = this.sanitize(query);
    const parts = ['search', 'results', sanitizedQuery];
    
    if (filters) {
      const filterHash = this.hashFilters(filters);
      parts.push(filterHash);
    }
    
    return parts.join(':');
  }

  /**
   * Key for search suggestions (autocomplete)
   */
  static searchSuggestions(prefix: string): string {
    return `search:suggestions:${this.sanitize(prefix)}`;
  }

  // ============ YOUTUBE API KEYS ============
  
  /**
   * Key for YouTube video metadata
   * Invalidation: Rarely (only on manual refresh)
   */
  static youtubeVideo(youtubeId: string): string {
    return `youtube:video:${youtubeId}`;
  }

  /**
   * Key for YouTube channel data
   * Invalidation: Rarely (only on manual refresh)
   */
  static youtubeChannel(channelId: string): string {
    return `youtube:channel:${channelId}`;
  }

  /**
   * Key for YouTube search results
   * Helps reduce API quota usage
   */
  static youtubeSearch(query: string, maxResults: number): string {
    return `youtube:search:${this.sanitize(query)}:max:${maxResults}`;
  }

  /**
   * Key for YouTube playlist data
   */
  static youtubePlaylist(playlistId: string): string {
    return `youtube:playlist:${playlistId}`;
  }

  // ============ TRENDING/POPULAR KEYS ============
  
  /**
   * Key for trending videos
   * Invalidation: Time-based (1 hour TTL)
   */
  static trendingVideos(limit = 10): string {
    return `trending:videos:${limit}`;
  }

  /**
   * Key for popular bands
   * Invalidation: Time-based (1 hour TTL)
   */
  static popularBands(limit = 10): string {
    return `popular:bands:${limit}`;
  }

  // ============ USER KEYS ============
  
  /**
   * Key for user session data
   * Invalidation: Logout, password change
   */
  static userSession(userId: string): string {
    return `user:session:${userId}`;
  }

  /**
   * Key for user preferences
   * Invalidation: User updates preferences
   */
  static userPreferences(userId: string): string {
    return `user:preferences:${userId}`;
  }

  /**
   * Key for user's refresh token
   * Invalidation: Logout, token rotation
   */
  static userRefreshToken(tokenId: string): string {
    return `user:refresh:${tokenId}`;
  }

  // ============ CATEGORY KEYS ============
  
  /**
   * Key for all categories
   * Invalidation: Category created/updated/deleted
   */
  static categories(): string {
    return 'categories:all';
  }

  /**
   * Key for individual category
   */
  static categoryDetail(categoryId: string): string {
    return `categories:detail:${categoryId}`;
  }

  // ============ CREATOR KEYS ============
  
  /**
   * Key for content creator details
   */
  static creatorDetail(creatorId: string): string {
    return `creators:detail:${creatorId}`;
  }

  /**
   * Key for creator list
   */
  static creatorList(filters?: Record<string, any>): string {
    if (!filters) return 'creators:list:all';
    return `creators:list:${this.hashFilters(filters)}`;
  }

  // ============ ADMIN DASHBOARD KEYS ============
  
  /**
   * Key for admin dashboard statistics
   * Invalidation: Time-based (5 minutes)
   */
  static dashboardStats(): string {
    return 'dashboard:stats';
  }

  /**
   * Key for recent videos
   */
  static dashboardRecentVideos(limit = 10): string {
    return `dashboard:recent:videos:${limit}`;
  }

  /**
   * Key for recent sync jobs
   */
  static dashboardRecentSyncJobs(limit = 10): string {
    return `dashboard:recent:sync:${limit}`;
  }

  // ============ INVALIDATION PATTERNS ============
  
  /**
   * Pattern to invalidate all band-related caches
   */
  static bandPattern(bandId?: string): string {
    return bandId ? `bands:*${bandId}*` : 'bands:*';
  }

  /**
   * Pattern to invalidate all video-related caches
   */
  static videoPattern(videoId?: string): string {
    return videoId ? `videos:*${videoId}*` : 'videos:*';
  }

  /**
   * Pattern to invalidate search caches
   */
  static searchPattern(): string {
    return 'search:*';
  }

  /**
   * Pattern to invalidate user caches
   */
  static userPattern(userId?: string): string {
    return userId ? `user:*${userId}*` : 'user:*';
  }

  /**
   * Pattern to invalidate YouTube API caches
   */
  static youtubePattern(): string {
    return 'youtube:*';
  }

  // ============ HELPER METHODS ============
  
  /**
   * Sanitize user input for cache keys
   * Removes special characters and limits length
   */
  private static sanitize(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .substring(0, 50);
  }

  /**
   * Create a hash of filter object for consistent cache keys
   * Sorts keys to ensure same filters produce same hash
   */
  private static hashFilters(filters: Record<string, any>): string {
    const sorted = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as Record<string, any>);
    
    return Buffer.from(JSON.stringify(sorted))
      .toString('base64')
      .substring(0, 16);
  }
}