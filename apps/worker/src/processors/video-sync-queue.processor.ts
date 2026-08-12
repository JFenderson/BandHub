import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { SyncBandHandler } from './sync-band.processor';
import { SyncAllBandsHandler } from './sync-all-bands.processor';
import { BackfillCreatorsHandler } from './backfill-creators.processor';
import { BackfillBandsHandler } from './backfill-bands.processor';

@Processor(QueueName.VIDEO_SYNC, {
  concurrency: 3,
})
export class VideoSyncQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoSyncQueueProcessor.name);

  constructor(
    private syncBandHandler: SyncBandHandler,
    private syncAllBandsHandler: SyncAllBandsHandler,
    private backfillCreatorsHandler: BackfillCreatorsHandler,
    private backfillBandsHandler: BackfillBandsHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.SYNC_BAND:
        return this.syncBandHandler.handle(job);
      case JobType.SYNC_ALL_BANDS:
        return this.syncAllBandsHandler.handle(job);
      case JobType.BACKFILL_CREATORS:
        return this.backfillCreatorsHandler.handle(job);
      case JobType.BACKFILL_BANDS:
        return this.backfillBandsHandler.handle(job);
      case JobType.UPDATE_STATS:
        this.logger.warn(
          `Job ${job.id} (update-stats) has no handler implementation yet — skipping`,
        );
        return undefined;
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on video-sync queue`);
        return undefined;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed`, error.stack);
  }
}
