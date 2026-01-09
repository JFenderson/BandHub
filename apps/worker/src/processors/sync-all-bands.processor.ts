import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
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


@Processor(QueueName.VIDEO_SYNC, {
  concurrency: 1,  // Only one sync-all job at a time
})
export class SyncAllBandsProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncAllBandsProcessor.name);
  
  constructor(
    private databaseService: DatabaseService,
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
  ) {
    super();
  }
  
  async process(job: Job<SyncAllBandsJobData>) {
    // This processor handles the SYNC_ALL_BANDS job type
    // The base class routes based on job name, so we need to check
    if (job.name !== JobType.SYNC_ALL_BANDS) {
      return;  // Let other processors handle it
    }
    
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