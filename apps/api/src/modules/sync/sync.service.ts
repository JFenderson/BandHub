import { Injectable } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { DatabaseService } from '../../database/database.service';
import { QUEUE_NAMES } from '@hbcu-band-hub/shared';

@Injectable()
export class SyncService {
  constructor(
    private readonly queueService: QueueService,
    private readonly database: DatabaseService,
  ) {}

  async triggerBandSync(bandId: string, syncType: 'channel' | 'playlist' | 'search', forceSync = false) {
    // Map our sync types to your existing job data format
    const jobSyncType = forceSync ? 'full' : 'incremental';
    
    // Use your existing addSyncBandJob method
    const job = await this.queueService.addSyncBandJob({
      bandId,
      syncType: jobSyncType,
    });

    return {
      jobId: job.id,
      message: `Sync job queued for band ${bandId}`,
    };
  }

  async triggerBulkSync(forceSync = false) {
    // Use your existing addSyncAllBandsJob method
    const job = await this.queueService.addSyncAllBandsJob();

    return {
      jobId: job.id,
      message: `Bulk sync job queued for all bands`,
    };
  }

  async getSyncStatus() {
    // Use your existing getQueueStats method
    return await this.queueService.getQueueStats(QUEUE_NAMES.YOUTUBE_SYNC);
  }

  async getJobStatus(jobId: string) {
    // Since we can't get individual jobs with your current service,
    // let's return the queue stats for now
    const stats = await this.queueService.getQueueStats(QUEUE_NAMES.YOUTUBE_SYNC);
    
    return {
      jobId,
      queueStats: stats,
      message: 'Use queue stats to monitor job progress',
    };
  }
}