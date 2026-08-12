import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { CleanupHandler } from './cleanup.processor';
import { NotificationHandler, NotificationJobData } from './notification.processor';
import { BackfillCategoriesHandler } from './backfill-categories.processor';

@Processor(QueueName.MAINTENANCE)
export class MaintenanceQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceQueueProcessor.name);

  constructor(
    private cleanupHandler: CleanupHandler,
    private notificationHandler: NotificationHandler,
    private backfillCategoriesHandler: BackfillCategoriesHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.CLEANUP_VIDEOS:
        return this.cleanupHandler.handle(job);
      case JobType.CATEGORIZE_VIDEOS:
        return this.backfillCategoriesHandler.handle(job);
      case 'NEW_VIDEO_NOTIFICATION':
      case 'WEEKLY_DIGEST':
        return this.notificationHandler.handle(job as Job<NotificationJobData>);
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on maintenance queue`);
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
