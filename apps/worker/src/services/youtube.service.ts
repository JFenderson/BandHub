import { Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { YouTubeVideoMetadata } from '@hbcu-band-hub/shared-types';

// Custom error types for better error handling upstream
export class YouTubeQuotaExceededError extends Error {
  constructor() {
    super('YouTube API quota exceeded');
    this.name = 'YouTubeQuotaExceededError';
  }
}

export class YouTubeRateLimitError extends Error {
  retryAfter: number;
  
  constructor(retryAfter: number) {
    super(`YouTube API rate limited. Retry after ${retryAfter}ms`);
    this.name = 'YouTubeRateLimitError';
    this.retryAfter = retryAfter;
  }
}

@Injectable()
export class YouTubeService {
  private youtube: youtube_v3.Youtube;
  private readonly logger = new Logger(YouTubeService.name);
  
  // Track API usage to avoid hitting limits
  private apiCallCount = 0;
  private lastResetTime = Date.now();
  private readonly MAX_CALLS_PER_MINUTE = 60;  // Conservative limit
  
  constructor(private configService: ConfigService) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.configService.get<string>('YOUTUBE_API_KEY'),
    });
  }
  
  /**
   * Search for videos matching band keywords
   * This is the main discovery method for finding new videos
   */
  async searchVideos(params: {
    query: string;
    channelId?: string;
    publishedAfter?: Date;
    maxResults?: number;
    pageToken?: string;
  }): Promise<{
    videos: YouTubeVideoMetadata[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    await this.checkRateLimit();
    
    try {
      // First, search for video IDs
      const searchResponse = await this.youtube.search.list({
        part: ['id'],
        q: params.query,
        channelId: params.channelId,
        publishedAfter: params.publishedAfter?.toISOString(),
        maxResults: params.maxResults || 50,
        pageToken: params.pageToken,
        type: ['video'],
        order: 'date',  // Most recent first
        relevanceLanguage: 'en',
        safeSearch: 'none',
      });
      
      this.apiCallCount++;
      
      const videoIds = searchResponse.data.items
        ?.map(item => item.id?.videoId)
        .filter((id): id is string => !!id) || [];
      
      if (videoIds.length === 0) {
        return {
          videos: [],
          nextPageToken: searchResponse.data.nextPageToken || undefined,
          totalResults: searchResponse.data.pageInfo?.totalResults || 0,
        };
      }
      
      // Then fetch full metadata for those videos
      // This is more efficient than fetching everything in the search
      const videos = await this.getVideoMetadata(videoIds);
      
      return {
        videos,
        nextPageToken: searchResponse.data.nextPageToken || undefined,
        totalResults: searchResponse.data.pageInfo?.totalResults || 0,
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Get full metadata for specific video IDs
   * Used both for initial fetch and for updating stats
   */
  async getVideoMetadata(videoIds: string[]): Promise<YouTubeVideoMetadata[]> {
  if (videoIds.length === 0) return [];
  
  await this.checkRateLimit();
  
  try {
    const chunks = this.chunkArray(videoIds, 50);
    const allVideos: YouTubeVideoMetadata[] = [];
    
    for (const chunk of chunks) {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: chunk,
      });
      
      this.apiCallCount++;
      
      const videos = response.data.items?.map(item => {
        // Safe thumbnail mapper
        const mapThumbnail = (thumb: youtube_v3.Schema$Thumbnail | null | undefined) => {
          if (!thumb?.url) return undefined;
          return {
            url: thumb.url,
            width: thumb.width ?? 0,
            height: thumb.height ?? 0,
          };
        };

        const video: YouTubeVideoMetadata = {
          id: item.id!,
          snippet: {
            title: item.snippet?.title || '',
            description: item.snippet?.description || null,
            publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
            channelId: item.snippet?.channelId || '',
            channelTitle: item.snippet?.channelTitle || '',
            thumbnails: {
              default: mapThumbnail(item.snippet?.thumbnails?.default),
              medium: mapThumbnail(item.snippet?.thumbnails?.medium),
              high: mapThumbnail(item.snippet?.thumbnails?.high),
            },
            tags: item.snippet?.tags || [],
          },
          contentDetails: {
            duration: item.contentDetails?.duration || 'PT0S',
          },
          statistics: {
            viewCount: item.statistics?.viewCount || '0',
            likeCount: item.statistics?.likeCount || null,
            commentCount: item.statistics?.commentCount || null,
          },
        };
        
        return video;
      }) || [];
      
      allVideos.push(...videos);
    }
    
    return allVideos;
  } catch (error) {
    this.handleApiError(error);
    throw error;
  }
}
  /**
   * Get videos from a specific channel
   * Used when we know a band's official YouTube channel
   */
  async getChannelVideos(params: {
    channelId: string;
    publishedAfter?: Date;
    maxResults?: number;
  }): Promise<YouTubeVideoMetadata[]> {
    await this.checkRateLimit();
    
    try {
      // Get the uploads playlist ID for the channel
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: [params.channelId],
      });
      
      this.apiCallCount++;
      
      const uploadsPlaylistId = 
        channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) {
        this.logger.warn(`No uploads playlist found for channel ${params.channelId}`);
        return [];
      }
      
      // Get videos from the uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: params.maxResults || 50,
      });
      
      this.apiCallCount++;
      
      const videoIds = playlistResponse.data.items
        ?.map(item => item.contentDetails?.videoId)
        .filter((id): id is string => !!id) || [];
      
      // Filter by publish date if specified
      const videos = await this.getVideoMetadata(videoIds);
      
      if (params.publishedAfter) {
        return videos.filter(
          video => new Date(video.snippet.publishedAt) >= params.publishedAfter!
        );
      }
      
      return videos;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Check if we're about to hit rate limits
   * Implements a simple sliding window rate limiter
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastResetTime;
    
    // Reset counter every minute
    if (elapsed > 60000) {
      this.apiCallCount = 0;
      this.lastResetTime = now;
    }
    
    // If we're at the limit, wait until the window resets
    if (this.apiCallCount >= this.MAX_CALLS_PER_MINUTE) {
      const waitTime = 60000 - elapsed + 1000;  // Add 1s buffer
      this.logger.warn(`Rate limit approaching, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.apiCallCount = 0;
      this.lastResetTime = Date.now();
    }
  }
  
  /**
   * Handle YouTube API errors and convert to our error types
   */
  private handleApiError(error: any): never {
    // Check for quota exceeded
    if (error.code === 403 && error.errors?.[0]?.reason === 'quotaExceeded') {
      this.logger.error('YouTube API quota exceeded');
      throw new YouTubeQuotaExceededError();
    }
    
    // Check for rate limiting
    if (error.code === 429) {
      const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10) * 1000;
      this.logger.warn(`YouTube API rate limited, retry after ${retryAfter}ms`);
      throw new YouTubeRateLimitError(retryAfter);
    }
    
    // Log and re-throw other errors
    this.logger.error('YouTube API error', {
      code: error.code,
      message: error.message,
      errors: error.errors,
    });
    
    throw error;
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current API usage stats for monitoring
   */
  getUsageStats() {
    return {
      callsThisMinute: this.apiCallCount,
      maxCallsPerMinute: this.MAX_CALLS_PER_MINUTE,
      windowResetTime: new Date(this.lastResetTime + 60000),
    };
  }
}