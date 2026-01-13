import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { 
  QueueName, 
  JobType, 
  BackfillCreatorsJobData,
} from '@hbcu-band-hub/shared-types';
import { SyncStatus } from '@prisma/client';
import { YouTubeService, YouTubeQuotaExceededError, YouTubeRateLimitError } from '../services/youtube.service';
import { DatabaseService } from '../services/database.service';
import { google, youtube_v3 } from 'googleapis';
import { ConfigService } from '@nestjs/config';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface BackfillResult {
  creatorsProcessed: number;
  videosAdded: number;
  videosUpdated: number;
  videosSkipped: number;
  quotaUsed: number;
  errors: string[];
  duration: number;
}

@Processor(QueueName.VIDEO_SYNC, {
  concurrency: 1, // Run one at a time to manage quota
})
export class BackfillCreatorsProcessor extends WorkerHost {
  private readonly logger = new Logger(BackfillCreatorsProcessor.name);
  private youtube: youtube_v3.Youtube;
  private quotaUsed = 0;
  private readonly DAILY_QUOTA_LIMIT: number;
  private readonly RATE_LIMIT_DELAY_MS = 1000;
  
  constructor(
    private youtubeService: YouTubeService,
    private databaseService: DatabaseService,
    private configService: ConfigService,
  ) {
    super();
    this.DAILY_QUOTA_LIMIT = parseInt(this.configService.get<string>('YOUTUBE_QUOTA_LIMIT', '10000'));
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.configService.get<string>('YOUTUBE_API_KEY'),
    });
  }
  
  async process(job: Job<BackfillCreatorsJobData>): Promise<BackfillResult> {
    const { triggeredBy, creatorId, limit } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`Starting creator videos backfill (triggered by: ${triggeredBy})`);
    this.quotaUsed = 0;
    
    const result: BackfillResult = {
      creatorsProcessed: 0,
      videosAdded: 0,
      videosUpdated: 0,
      videosSkipped: 0,
      quotaUsed: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Get creators to sync
      const creators = await this.getCreatorsToSync(creatorId, limit);
      
      if (creators.length === 0) {
        this.logger.log('No content creators with YouTube channels to sync');
        result.duration = Date.now() - startTime;
        return result;
      }
      
      this.logger.log(`Found ${creators.length} content creators to process`);
      
      await job.updateProgress({
        stage: 'processing',
        current: 0,
        total: creators.length,
        message: `Processing ${creators.length} creators`,
      });
      
      for (const [index, creator] of creators.entries()) {
        // Check quota
        if (this.quotaUsed >= this.DAILY_QUOTA_LIMIT * 0.9) {
          this.logger.warn(`Approaching daily quota limit (${this.quotaUsed}/${this.DAILY_QUOTA_LIMIT})`);
          result.errors.push('Quota limit reached');
          break;
        }
        
        this.logger.log(`[${index + 1}/${creators.length}] Processing: ${creator.name}`);
        
        try {
          const creatorResult = await this.syncCreatorVideos(creator);
          result.videosAdded += creatorResult.added;
          result.videosUpdated += creatorResult.updated;
          result.videosSkipped += creatorResult.skipped;
          result.quotaUsed += creatorResult.quotaUsed;
          result.creatorsProcessed++;
          
          this.logger.log(`   ✅ Added: ${creatorResult.added}, Updated: ${creatorResult.updated}, Skipped: ${creatorResult.skipped}`);
        } catch (error) {
          const errorMsg = `Failed to sync ${creator.name}: ${getErrorMessage(error)}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
        
        await job.updateProgress({
          stage: 'processing',
          current: index + 1,
          total: creators.length,
          message: `Processed ${index + 1}/${creators.length} creators`,
        });
        
        // Rate limiting between creators
        if (index < creators.length - 1) {
          await this.sleep(this.RATE_LIMIT_DELAY_MS * 2);
        }
      }
      
    } catch (error) {
      this.logger.error('Backfill creators failed', error);
      result.errors.push(getErrorMessage(error));
      throw error;
    }
    
    result.duration = Date.now() - startTime;
    
    this.logger.log(
      `Completed creator backfill: ${result.creatorsProcessed} creators, ` +
      `${result.videosAdded} added, ${result.videosUpdated} updated, ` +
      `${result.quotaUsed} quota used`
    );
    
    return result;
  }
  
  private async getCreatorsToSync(specificCreatorId?: string, limit?: number) {
    const where: any = {
      NOT: {
        youtubeChannelId: '',
      },
    };
    
    if (specificCreatorId) {
      where.id = specificCreatorId;
    }
    
    return this.databaseService.prisma.contentCreator.findMany({
      where,
      select: {
        id: true,
        name: true,
        youtubeChannelId: true,
        lastSyncedAt: true,
        lastFullSync: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
  }
  
  private async syncCreatorVideos(creator: {
    id: string;
    name: string;
    youtubeChannelId: string;
    lastSyncedAt: Date | null;
  }) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let creatorQuotaUsed = 0;
    
    try {
      // Get uploads playlist ID
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: [creator.youtubeChannelId],
      });
      creatorQuotaUsed += 1;
      this.quotaUsed += 1;
      
      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        this.logger.warn(`No uploads playlist found for channel ${creator.youtubeChannelId}`);
        return { added, updated, skipped, quotaUsed: creatorQuotaUsed };
      }
      
      // Fetch all videos from uploads playlist with pagination
      let pageToken: string | undefined;
      const allVideoItems: any[] = [];
      
      do {
        const playlistResponse = await this.youtube.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          pageToken,
        });
        creatorQuotaUsed += 1;
        this.quotaUsed += 1;
        
        allVideoItems.push(...(playlistResponse.data.items || []));
        pageToken = playlistResponse.data.nextPageToken || undefined;
        
        this.logger.log(`   📥 Fetched ${allVideoItems.length} video items...`);
      } while (pageToken);
      
      this.logger.log(`   📹 Total videos found: ${allVideoItems.length}`);
      
      // Process videos in batches for detail enrichment
      const batchSize = 50;
      for (let i = 0; i < allVideoItems.length; i += batchSize) {
        const batch = allVideoItems.slice(i, i + batchSize);
        const videoIds = batch
          .map((item) => item.snippet?.resourceId?.videoId)
          .filter(Boolean);
        
        // Get video details (duration, view count, etc.)
        let videoDetails: Map<string, { duration: number; viewCount: number; likeCount: number }> = new Map();
        
        if (videoIds.length > 0) {
          const detailsResponse = await this.youtube.videos.list({
            part: ['contentDetails', 'statistics'],
            id: videoIds,
          });
          creatorQuotaUsed += 1;
          this.quotaUsed += 1;
          
          for (const item of detailsResponse.data.items || []) {
            if (item.id) {
              videoDetails.set(item.id, {
                duration: this.parseDuration(item.contentDetails?.duration || ''),
                viewCount: parseInt(item.statistics?.viewCount || '0'),
                likeCount: parseInt(item.statistics?.likeCount || '0'),
              });
            }
          }
        }
        
        // Upsert each video
        for (const item of batch) {
          const videoId = item.snippet?.resourceId?.videoId;
          if (!videoId) continue;
          
          const details = videoDetails.get(videoId) || { duration: 0, viewCount: 0, likeCount: 0 };
          const publishedAt = new Date(item.snippet?.publishedAt || item.contentDetails?.videoPublishedAt || new Date());
          
          try {
            const existing = await this.databaseService.prisma.youTubeVideo.findUnique({
              where: { youtubeId: videoId },
            });
            
            if (existing) {
              // Update existing video
              await this.databaseService.prisma.youTubeVideo.update({
                where: { id: existing.id },
                data: {
                  title: item.snippet?.title || 'Unknown',
                  description: item.snippet?.description || '',
                  thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                               item.snippet?.thumbnails?.default?.url || '',
                  viewCount: details.viewCount,
                  likeCount: details.likeCount,
                  lastSyncedAt: new Date(),
                  syncStatus: SyncStatus.COMPLETED,
                  // If video was already linked to a creator, keep it; otherwise, link to this creator
                  creatorId: existing.creatorId || creator.id,
                },
              });
              updated++;
            } else {
              // Create new video (bandId = null for matching later)
              await this.databaseService.prisma.youTubeVideo.create({
                data: {
                  youtubeId: videoId,
                  title: item.snippet?.title || 'Unknown',
                  description: item.snippet?.description || '',
                  thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                               item.snippet?.thumbnails?.default?.url || '',
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  duration: details.duration,
                  publishedAt,
                  viewCount: details.viewCount,
                  likeCount: details.likeCount,
                  channelId: item.snippet?.channelId || creator.youtubeChannelId,
                  channelTitle: item.snippet?.channelTitle || creator.name,
                  creatorId: creator.id,
                  bandId: null, // Will be matched later
                  syncStatus: SyncStatus.COMPLETED,
                  lastSyncedAt: new Date(),
                },
              });
              added++;
            }
          } catch (error) {
            this.logger.warn(`Error processing video ${videoId}: ${getErrorMessage(error)}`);
            skipped++;
          }
        }
        
        // Rate limiting between batches
        await this.sleep(this.RATE_LIMIT_DELAY_MS);
      }
      
      // Update creator sync tracking
      await this.databaseService.prisma.contentCreator.update({
        where: { id: creator.id },
        data: {
          lastSyncedAt: new Date(),
          lastFullSync: new Date(),
          videosInOurDb: await this.databaseService.prisma.youTubeVideo.count({
            where: { creatorId: creator.id },
          }),
        },
      });
      
    } catch (error) {
      this.logger.error(`Error syncing creator: ${getErrorMessage(error)}`);
      throw error;
    }
    
    return { added, updated, skipped, quotaUsed: creatorQuotaUsed };
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
  
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }
  
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed`, error.stack);
  }
}
