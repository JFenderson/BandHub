import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { 
  QueueName, 
  JobType, 
  SyncBandJobData, 
  SyncJobResult,
  ProcessVideoJobData,
  SyncMode,
} from '@hbcu-band-hub/shared-types';
import { SyncJobType, SyncJobStatus } from '@prisma/client';
import { YouTubeService, YouTubeQuotaExceededError, YouTubeRateLimitError } from '../services/youtube.service';
import { DatabaseService } from '../services/database.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

@Processor(QueueName.VIDEO_SYNC, {
  concurrency: 3,
})
export class SyncBandProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncBandProcessor.name);
  
  constructor(
    private youtubeService: YouTubeService,
    private databaseService: DatabaseService,
    @InjectQueue(QueueName.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
  ) {
    super();
  }
  
  async process(job: Job<SyncBandJobData>): Promise<SyncJobResult> {
    const { bandId, mode, triggeredBy } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`Starting sync for band ${bandId} (mode: ${mode}, triggered by: ${triggeredBy})`);
    
    // Create sync job record in database
    const syncJobRecord = await this.databaseService.createSyncJob({
      bandId,
      jobType: mode === SyncMode.INCREMENTAL ? SyncJobType.INCREMENTAL_SYNC : SyncJobType.FULL_SYNC,
    });
    
    // Update status to in progress
    await this.databaseService.updateSyncJob(syncJobRecord.id, {
      status: SyncJobStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    
    // Update band status
    await this.databaseService.updateBandSyncStatus(bandId, {
      lastSyncAt: new Date(),
      syncStatus: 'IN_PROGRESS' as any,
    });
    
    const result: SyncJobResult = {
      bandId,
      bandName: '',
      videosFound: 0,
      videosCreated: 0,
      videosUpdated: 0,
      videosSkipped: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Get band details
      const band = await this.databaseService.getBandById(bandId);
      if (!band) {
        throw new Error(`Band not found: ${bandId}`);
      }
      
      result.bandName = band.name;
      
      await job.updateProgress({
        stage: 'searching',
        current: 0,
        total: 100,
        message: `Searching YouTube for ${band.name} videos`,
      });
      
      // Determine search parameters
      const publishedAfter = mode === SyncMode.INCREMENTAL && band.lastSyncAt
        ? band.lastSyncAt
        : undefined;
      
      // Build search queries
      const searchQueries = this.buildSearchQueries(band);
      const foundVideoIds = new Set<string>();
      
      for (const query of searchQueries) {
        try {
          const searchResult = await this.youtubeService.searchVideos({
            query,
            publishedAfter,
            maxResults: job.data.maxResults || 50,
          });
          
          for (const videoMetadata of searchResult.videos) {
            if (foundVideoIds.has(videoMetadata.id)) continue;
            foundVideoIds.add(videoMetadata.id);
            result.videosFound++;
            
            try {
              await this.videoProcessingQueue.add(
                JobType.PROCESS_VIDEO,
                {
                  type: JobType.PROCESS_VIDEO,
                  videoId: videoMetadata.id,
                  bandId,
                  rawMetadata: videoMetadata,
                  isUpdate: await this.databaseService.videoExists(videoMetadata.id),
                } as ProcessVideoJobData,
                {
                  priority: 3,
                  attempts: 2,
                  backoff: { type: 'exponential', delay: 5000 },
                }
              );
            } catch (error) {
              this.logger.error(`Failed to queue video ${videoMetadata.id}`, error);
              result.errors.push(`Video ${videoMetadata.id}: ${getErrorMessage(error)}`);
            }
          }
          
          const progressPercent = Math.round(
            (searchQueries.indexOf(query) + 1) / searchQueries.length * 100
          );
          await job.updateProgress({
            stage: 'processing',
            current: progressPercent,
            total: 100,
            message: `Processed ${result.videosFound} videos`,
          });
          
        } catch (error) {
          if (error instanceof YouTubeQuotaExceededError) {
            this.logger.error('YouTube quota exceeded, stopping sync');
            result.errors.push('YouTube API quota exceeded');
            break;
          } else if (error instanceof YouTubeRateLimitError) {
            this.logger.warn(`Rate limited, waiting ${error.retryAfter}ms`);
            await this.sleep(error.retryAfter);
            searchQueries.push(query);
          } else {
            this.logger.error(`Search failed for query "${query}"`, error);
            result.errors.push(`Search "${query}": ${getErrorMessage(error)}`);
          }
        }
      }
      
      // Fetch from official channel if available
      if (band.youtubeChannelId) {
        await job.updateProgress({
          stage: 'channel-fetch',
          current: 90,
          total: 100,
          message: 'Fetching from official channel',
        });
        
        try {
          const channelVideos = await this.youtubeService.getChannelVideos({
            channelId: band.youtubeChannelId,
            publishedAfter,
            maxResults: 50,
          });
          
          for (const videoMetadata of channelVideos) {
            if (foundVideoIds.has(videoMetadata.id)) continue;
            foundVideoIds.add(videoMetadata.id);
            result.videosFound++;
            
            await this.videoProcessingQueue.add(
              JobType.PROCESS_VIDEO,
              {
                type: JobType.PROCESS_VIDEO,
                videoId: videoMetadata.id,
                bandId,
                rawMetadata: videoMetadata,
                isUpdate: await this.databaseService.videoExists(videoMetadata.id),
              } as ProcessVideoJobData,
              { priority: 3, attempts: 2 }
            );
          }
        } catch (error) {
          this.logger.error(`Channel fetch failed for ${band.youtubeChannelId}`, error);
          result.errors.push(`Channel fetch: ${getErrorMessage(error)}`);
        }
      }
      
      // Update sync job record
      await this.databaseService.updateSyncJob(syncJobRecord.id, {
        status: SyncJobStatus.COMPLETED,
        videosFound: result.videosFound,
        videosAdded: result.videosCreated,
        videosUpdated: result.videosUpdated,
        errors: result.errors,
        completedAt: new Date(),
      });
      
      // Update band status
      await this.databaseService.updateBandSyncStatus(bandId, {
        lastSyncAt: new Date(),
        syncStatus: 'COMPLETED' as any,
      });
      
    } catch (error) {
      this.logger.error(`Band sync failed for ${bandId}`, error);
      result.errors.push(getErrorMessage(error));
      
      // Update sync job as failed
      await this.databaseService.updateSyncJob(syncJobRecord.id, {
        status: SyncJobStatus.FAILED,
        errors: result.errors,
        completedAt: new Date(),
      });
      
      // Update band status
      await this.databaseService.updateBandSyncStatus(bandId, {
        lastSyncAt: new Date(),
        syncStatus: 'FAILED' as any,
      });
      
      throw error;
    }
    
    result.duration = Date.now() - startTime;
    
    this.logger.log(
      `Completed sync for ${result.bandName}: ` +
      `${result.videosFound} found, ${result.videosCreated} created, ` +
      `${result.videosUpdated} updated`
    );
    
    return result;
  }
  
  private buildSearchQueries(band: any): string[] {
    const queries: string[] = [];
    
    queries.push(`"${band.name}" marching band`);
    
    if (band.schoolName && band.schoolName !== band.name) {
      queries.push(`"${band.schoolName}" marching band`);
    }
    
    // Note: Your schema doesn't have an aliases field
    // If you want this feature, add: aliases String[] to Band model
    
    queries.push(`"${band.name}" HBCU`);
    
    return queries;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed for band ${job.data.bandId}`);
  }
  
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed for band ${job.data.bandId}`, error.stack);
  }
}