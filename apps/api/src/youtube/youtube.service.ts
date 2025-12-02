import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, youtube_v3 } from 'googleapis';
import { DatabaseService } from '../database/database.service';

export interface VideoMetadata {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
  publishedAt: Date;
  channelId: string;
  channelTitle: string;
  duration: number;
  viewCount: number;
  likeCount: number;
}

export interface FetchAllVideosOptions {
  publishedAfter?: Date;
  publishedBefore?: Date;
  maxVideos?: number;
  onProgress?: (fetched: number, total: number) => void;
}

export interface FetchAllVideosResult {
  videos: VideoMetadata[];
  totalFetched: number;
  quotaUsed: number;
  errors: string[];
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private youtube: youtube_v3.Youtube | null = null;
  private quotaLimit: number;

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
  ) {
    const apiKey = this.configService.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      this.logger.warn('YouTube API key not found. Video sync will be disabled.');
      return;
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });

    this.quotaLimit = this.configService.get<number>('YOUTUBE_QUOTA_LIMIT') || 10000;
  }

  /**
   * Check if YouTube API is configured
   */
  isConfigured(): boolean {
    return this.youtube !== null;
  }

  /**
   * Get the uploads playlist ID for a channel
   */
  async getUploadsPlaylistId(channelId: string): Promise<string | null> {
    if (!this.youtube) throw new Error('YouTube API not configured');

    try {
      const response = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: [channelId],
      });

      return response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
    } catch (error: unknown) {
      this.logger.error(`Error getting uploads playlist for channel ${channelId}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Fetch ALL videos from a channel using the uploads playlist method (quota efficient)
   * Uses pagination to get all videos
   */
  async fetchAllChannelVideos(
    channelId: string,
    options: FetchAllVideosOptions = {},
  ): Promise<FetchAllVideosResult> {
    if (!this.youtube) throw new Error('YouTube API not configured');

    const result: FetchAllVideosResult = {
      videos: [],
      totalFetched: 0,
      quotaUsed: 0,
      errors: [],
    };

    try {
      // Get the uploads playlist ID (costs 1 quota unit)
      const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
      result.quotaUsed += 1;

      if (!uploadsPlaylistId) {
        result.errors.push(`Could not find uploads playlist for channel ${channelId}`);
        return result;
      }

      // Fetch all videos from the uploads playlist with pagination
      let pageToken: string | undefined;
      const maxResults = 50; // Maximum allowed per request
      const maxVideos = options.maxVideos || Infinity;

      do {
        const playlistResponse = await this.youtube.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults,
          pageToken,
        });
        result.quotaUsed += 1; // PlaylistItems.list costs 1 quota unit

        const items = playlistResponse.data.items || [];
        
        for (const item of items) {
          if (result.videos.length >= maxVideos) break;

          const videoId = item.snippet?.resourceId?.videoId;
          if (!videoId) continue;

          const publishedAt = new Date(item.snippet?.publishedAt || item.contentDetails?.videoPublishedAt || new Date());

          // Filter by date range if specified
          if (options.publishedAfter && publishedAt < options.publishedAfter) {
            continue;
          }
          if (options.publishedBefore && publishedAt > options.publishedBefore) {
            continue;
          }

          result.videos.push({
            youtubeId: videoId,
            title: item.snippet?.title || 'Unknown Title',
            description: item.snippet?.description || '',
            thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                         item.snippet?.thumbnails?.medium?.url ||
                         item.snippet?.thumbnails?.default?.url || '',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            publishedAt,
            channelId: item.snippet?.channelId || channelId,
            channelTitle: item.snippet?.channelTitle || '',
            duration: 0, // Will be filled by getVideoDetails
            viewCount: 0, // Will be filled by getVideoDetails
            likeCount: 0, // Will be filled by getVideoDetails
          });
        }

        result.totalFetched = result.videos.length;

        // Report progress if callback provided
        if (options.onProgress) {
          const totalResults = playlistResponse.data.pageInfo?.totalResults || result.totalFetched;
          options.onProgress(result.totalFetched, totalResults);
        }

        pageToken = playlistResponse.data.nextPageToken || undefined;

        // Check if we've reached max videos
        if (result.videos.length >= maxVideos) {
          break;
        }
      } while (pageToken);

      // Fetch video details in batches (for duration, view count, like count)
      await this.enrichVideoDetails(result);

      this.logger.log(`Fetched ${result.videos.length} videos from channel ${channelId}, quota used: ${result.quotaUsed}`);
    } catch (error: unknown) {
      const errorMessage = (error as Error).message;
      result.errors.push(`Error fetching videos from channel ${channelId}: ${errorMessage}`);
      this.logger.error(`Error fetching all channel videos:`, errorMessage);
    }

    return result;
  }

  /**
   * Enrich videos with details (duration, view count, like count)
   * Batches requests for efficiency
   */
  private async enrichVideoDetails(result: FetchAllVideosResult): Promise<void> {
    if (!this.youtube) return;

    const batchSize = 50; // Maximum IDs per request
    const videos = result.videos;

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      const videoIds = batch.map((v) => v.youtubeId);

      try {
        const response = await this.youtube.videos.list({
          part: ['contentDetails', 'statistics'],
          id: videoIds,
        });
        result.quotaUsed += 1; // Videos.list costs 1 quota unit

        const items = response.data.items || [];
        for (const item of items) {
          const video = videos.find((v) => v.youtubeId === item.id);
          if (video && item.contentDetails && item.statistics) {
            video.duration = this.parseDuration(item.contentDetails.duration || '');
            video.viewCount = parseInt(item.statistics.viewCount || '0');
            video.likeCount = parseInt(item.statistics.likeCount || '0');
          }
        }
      } catch (error: unknown) {
        result.errors.push(`Error enriching video details batch: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Fetch videos from a channel published after a specific date (for incremental sync)
   */
  async fetchNewChannelVideos(
    channelId: string,
    publishedAfter: Date,
    maxVideos = 50,
  ): Promise<FetchAllVideosResult> {
    return this.fetchAllChannelVideos(channelId, {
      publishedAfter,
      maxVideos,
    });
  }

  async findChannelByHandle(handle: string) {
    if (!this.youtube) throw new Error('YouTube API not configured');

    try {
      // Remove @ if present
      const cleanHandle = handle.replace('@', '');
      
      const response = await this.youtube.channels.list({
        part: ['id', 'snippet', 'statistics'], // Array of strings
        forHandle: cleanHandle,
      });

      return response.data.items?.[0] || null;
    } catch (error: unknown) {
      this.logger.error(`Error finding channel ${handle}:`, (error as Error).message);
      return null;
    }
  }

  async searchVideosForBand(bandId: string, keywords: string[], maxResults = 50) {
    if (!this.youtube) throw new Error('YouTube API not configured');

    const band = await this.db.band.findUnique({ where: { id: bandId } });
    if (!band) throw new Error('Band not found');

    const searchTerms = [
      ...keywords,
      'marching band',
      'HBCU',
      band.schoolName
    ];

    const query = searchTerms.join(' ');

    const params: youtube_v3.Params$Resource$Search$List = {
  part: ['snippet'],
  q: query,
  type: ['video'],
  maxResults,
  order: 'relevance',
  publishedAfter: new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  ).toISOString(),
  videoDuration: 'any',
};
    
    try {
   const response = await this.youtube.search.list(params);

      const videos = [];
      
      for (const item of response.data.items || []) {
        if (!item.id?.videoId) continue;
        
        // Get detailed video info
        const videoDetails = await this.getVideoDetails(item.id.videoId);
        if (videoDetails) {
          videos.push({
            youtubeId: item.id.videoId,
            title: item.snippet?.title || 'Unknown Title',
            description: item.snippet?.description || '',
            thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                         item.snippet?.thumbnails?.default?.url || '',
            publishedAt: new Date(item.snippet?.publishedAt || new Date()),
            channelId: item.snippet?.channelId || '',
            channelTitle: item.snippet?.channelTitle || '',
            duration: videoDetails.duration,
            viewCount: parseInt(videoDetails.viewCount || '0'),
            bandId,
          });
        }
      }

      return videos;
    } catch (error: unknown) {
      this.logger.error(`Error searching videos for band ${band.name}:`, (error as Error).message);
      return [];
    }
  }

  async getChannelVideos(channelId: string, maxResults = 50) {
    if (!this.youtube) throw new Error('YouTube API not configured');

    try {
      // First get the uploads playlist
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'], // Array of strings
        id: [channelId], // Array of strings
      });

      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) return [];

      // Get videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet'], // Array of strings
        playlistId: uploadsPlaylistId,
        maxResults,
      });

      const videos = [];
      
      for (const item of playlistResponse.data.items || []) {
        if (!item.snippet?.resourceId?.videoId) continue;
        
        const videoDetails = await this.getVideoDetails(item.snippet.resourceId.videoId);
        if (videoDetails) {
          videos.push({
            youtubeId: item.snippet.resourceId.videoId,
            title: item.snippet.title || 'Unknown Title',
            description: item.snippet.description || '',
            thumbnailUrl: item.snippet.thumbnails?.high?.url || 
                         item.snippet.thumbnails?.default?.url || '',
            publishedAt: new Date(item.snippet.publishedAt || new Date()),
            channelId: item.snippet.channelId || '',
            channelTitle: item.snippet.channelTitle || '',
            duration: videoDetails.duration,
            viewCount: parseInt(videoDetails.viewCount || '0'),
          });
        }
      }

      return videos;
    } catch (error: unknown) {
      this.logger.error(`Error getting channel videos:`, (error as Error).message);
      return [];
    }
  }

  async getVideoDetails(videoId: string) {
    if (!this.youtube) return null;
    
    try {
      const response = await this.youtube.videos.list({
        part: ['contentDetails', 'statistics'], // Array of strings
        id: [videoId], // Array of strings
      });

      const video = response.data.items?.[0];
      if (!video) return null;
      
      return {
        duration: this.parseDuration(video.contentDetails?.duration || ''),
        viewCount: video.statistics?.viewCount || '0',
        likeCount: video.statistics?.likeCount || '0',
      };
    } catch (error: unknown) {
      this.logger.error(`Error getting video details for ${videoId}:`, (error as Error).message);
      return null;
    }
  }

  private parseDuration(isoDuration: string): number {
    if (!isoDuration) return 0;
    
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0'); 
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }
}