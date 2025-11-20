import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, youtube_v3 } from 'googleapis';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private youtube: youtube_v3.Youtube | null = null;

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

  private async getVideoDetails(videoId: string) {
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