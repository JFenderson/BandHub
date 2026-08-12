import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { ProcessVideoHandler } from './process-video.processor';
import { ClassifyVideosHandler } from './classify-videos.processor';
import { MatchVideosHandler } from './match-videos.processor';
import { PromoteVideosHandler } from './promote-videos.processor';
import { RematchVideosHandler } from './rematch-videos.processor';

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 10,
})
export class VideoProcessingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingQueueProcessor.name);

  constructor(
    private processVideoHandler: ProcessVideoHandler,
    private classifyVideosHandler: ClassifyVideosHandler,
    private matchVideosHandler: MatchVideosHandler,
    private promoteVideosHandler: PromoteVideosHandler,
    private rematchVideosHandler: RematchVideosHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.PROCESS_VIDEO:
        return this.processVideoHandler.handle(job);
      case JobType.CLASSIFY_VIDEOS:
        return this.classifyVideosHandler.handle(job);
      case JobType.MATCH_VIDEOS:
        return this.matchVideosHandler.handle(job);
      case JobType.PROMOTE_VIDEOS:
        return this.promoteVideosHandler.handle(job);
      case JobType.REMATCH_VIDEOS:
        return this.rematchVideosHandler.handle(job);
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on video-processing queue`);
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
