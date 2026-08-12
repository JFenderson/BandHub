import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  QueueName,
  JobType,
  SyncAllBandsJobData,
  SyncBandJobData,
  JobPriority,
} from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';


@Injectable()
export class SyncAllBandsHandler {
  private readonly logger = new Logger(SyncAllBandsHandler.name);

  constructor(
    private databaseService: DatabaseService,
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
  ) {}

  async handle(job: Job<SyncAllBandsJobData>) {
    const { mode, triggeredBy, batchSize = 5 } = job.data;
    
    this.logger.log(`Starting sync for all bands (mode: ${mode}, triggered by: ${triggeredBy})`);
    
    // Get all active bands
    const bands = await this.databaseService.getActiveBands();
    
    this.logger.log(`Found ${bands.length} active bands to sync`);
    
    // Queue sync jobs for each band
    const jobPromises = bands.map((band, index) => {
      return this.videoSyncQueue.add(
        JobType.SYNC_BAND,
        {
          type: JobType.SYNC_BAND,
          bandId: band.id,
          mode,
          triggeredBy: 'system',
        } as SyncBandJobData,
        {
          // Stagger job priorities so they don't all start at once
          priority: JobPriority.NORMAL + Math.floor(index / batchSize),
          // Add delay to spread out API usage
          delay: Math.floor(index / batchSize) * 60000,  // 1 minute between batches
          // Standard retry config
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,  // 30 seconds base delay
          },
        }
      );
    });
    
    await Promise.all(jobPromises);
    
    await job.updateProgress({
      stage: 'queued',
      current: 100,
      total: 100,
      message: `Queued ${bands.length} band sync jobs`,
    });
    
    return {
      bandsQueued: bands.length,
      batchSize,
      estimatedDuration: Math.ceil(bands.length / batchSize) * 60000,
    };
  }
}