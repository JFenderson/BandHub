import { google } from 'googleapis';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  channelId: string;
  channelTitle: string;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  nextPageToken?: string;
  totalResults: number;
}

export class YouTubeService {
  private youtube;
  private apiKey: string;
  private quotaUsed: number = 0;
  private quotaLimit: number;

  constructor(apiKey: string, quotaLimit: number = 10000) {
    this.apiKey = apiKey;
    this.quotaLimit = quotaLimit;
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });
  }

  getQuotaUsage() {
    return {
      used: this.quotaUsed,
      remaining: this.quotaLimit - this.quotaUsed,
      limit: this.quotaLimit,
    };
  }

  private addQuotaCost(cost: number) {
    this.quotaUsed += cost;
    console.log(`📊 YouTube quota used: ${this.quotaUsed}/${this.quotaLimit}`);
  }

  async searchVideos(query: string, maxResults: number = 50, pageToken?: string): Promise<YouTubeSearchResult> {
    try {
      // Search request costs 100 quota units
      this.addQuotaCost(100);

      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults,
        pageToken,
        order: 'relevance',
        publishedAfter: '2020-01-01T00:00:00Z', // Only videos from 2020 onwards
      });

     const videoIds = response.data.items
  ?.map(item => item.id?.videoId)
  .filter((id): id is string => typeof id === 'string') || [];

      if (videoIds.length === 0) {
        return { videos: [], totalResults: 0 };
      }

      // Get detailed video information
      const videos = await this.getVideoDetails(videoIds);

      return {
        videos,
        nextPageToken: response.data.nextPageToken || undefined,
        totalResults: response.data.pageInfo?.totalResults || 0,
      };
    } catch (error) {
      console.error('YouTube search error:', error);
      throw error;
    }
  }

  async getChannelVideos(channelId: string, maxResults: number = 50, pageToken?: string): Promise<YouTubeSearchResult> {
    try {
      // Search request costs 100 quota units
      this.addQuotaCost(100);

      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId,
        type: ['video'],
        maxResults,
        pageToken,
        order: 'date',
        publishedAfter: '2020-01-01T00:00:00Z',
      });

      const videoIds = response.data.items
  ?.map(item => item.id?.videoId)
  .filter((id): id is string => typeof id === 'string') || [];

      if (videoIds.length === 0) {
        return { videos: [], totalResults: 0 };
      }

      const videos = await this.getVideoDetails(videoIds);

      return {
        videos,
        nextPageToken: response.data.nextPageToken || undefined,
        totalResults: response.data.pageInfo?.totalResults || 0,
      };
    } catch (error) {
      console.error('YouTube channel videos error:', error);
      throw error;
    }
  }

  async getPlaylistVideos(playlistId: string, maxResults: number = 50, pageToken?: string): Promise<YouTubeSearchResult> {
    try {
      // Playlist items request costs 1 quota unit
      this.addQuotaCost(1);

      const response = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId,
        maxResults,
        pageToken,
      });

      const videoIds = response.data.items
  ?.map(item => item.snippet?.resourceId?.videoId)
  .filter((id): id is string => typeof id === 'string') || [];

      if (videoIds.length === 0) {
        return { videos: [], totalResults: 0 };
      }

      const videos = await this.getVideoDetails(videoIds);

      return {
        videos,
        nextPageToken: response.data.nextPageToken || undefined,
        totalResults: response.data.pageInfo?.totalResults || 0,
      };
    } catch (error) {
      console.error('YouTube playlist videos error:', error);
      throw error;
    }
  }

  private async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    try {
      // Videos request costs 1 quota unit per call (not per video)
      this.addQuotaCost(1);

      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      });

      return response.data.items?.map(item => ({
        id: item.id!,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        publishedAt: item.snippet?.publishedAt || '',
        duration: this.parseDuration(item.contentDetails?.duration || ''),
        thumbnailUrl: item.snippet?.thumbnails?.maxres?.url || 
                     item.snippet?.thumbnails?.high?.url || 
                     item.snippet?.thumbnails?.medium?.url || '',
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        likeCount: parseInt(item.statistics?.likeCount || '0'),
        channelId: item.snippet?.channelId || '',
        channelTitle: item.snippet?.channelTitle || '',
      })) || [];
    } catch (error) {
      console.error('YouTube video details error:', error);
      throw error;
    }
  }

  private parseDuration(isoDuration: string): string {
    // Convert ISO 8601 duration (PT15M33S) to seconds
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0';

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return String(hours * 3600 + minutes * 60 + seconds);
  }

  async testConnection(): Promise<boolean> {
    try {
      this.addQuotaCost(1);
      
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: 'test',
        maxResults: 1,
      });

      return response.status === 200;
    } catch (error) {
      console.error('YouTube connection test failed:', error);
      return false;
    }
  }
}