import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType, ClassifyVideosJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { BandLibrarianService } from '../services/band-librarian.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface ClassifyResult {
  totalProcessed: number;
  classified: number;
  excluded: number;
  errors: string[];
  duration: number;
}

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 1,
})
export class ClassifyVideosProcessor extends WorkerHost {
  private readonly logger = new Logger(ClassifyVideosProcessor.name);
  private readonly BATCH_SIZE = 20;

  constructor(
    private databaseService: DatabaseService,
    private bandLibrarian: BandLibrarianService,
  ) {
    super();
  }

  async process(job: Job<ClassifyVideosJobData>): Promise<ClassifyResult> {
    const { triggeredBy, limit } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting video classification backfill (triggered by: ${triggeredBy})`);

    const result: ClassifyResult = {
      totalProcessed: 0,
      classified: 0,
      excluded: 0,
      errors: [],
      duration: 0,
    };

    let cursor: string | undefined;
    let batchCount = 0;
    const maxVideos = limit ?? Infinity;

    while (result.totalProcessed < maxVideos) {
      const take = Math.min(this.BATCH_SIZE, maxVideos - result.totalProcessed);

      const batch = await this.databaseService.youTubeVideo.findMany({
        where: { aiProcessed: false },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          description: true,
          channelTitle: true,
        },
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (batch.length === 0) break;

      cursor = batch[batch.length - 1].id;

      await job.updateProgress({
        stage: 'classifying',
        current: result.totalProcessed,
        total: result.totalProcessed + batch.length,
        message: `Classifying batch ${batchCount + 1}`,
      });

      for (const video of batch) {
        result.totalProcessed++;
        try {
          const extraction = await this.bandLibrarian.classify({
            title: video.title,
            description: video.description ?? '',
            tags: [],
            channelTitle: video.channelTitle ?? '',
          });

          await this.databaseService.youTubeVideo.update({
            where: { id: video.id },
            data: {
              aiExtraction: extraction as any,
              aiProcessed: true,
              aiExcluded: !extraction.isHbcuBandContent,
            },
          });

          result.classified++;
          if (!extraction.isHbcuBandContent) result.excluded++;
        } catch (err) {
          result.errors.push(`Error classifying ${video.youtubeId}: ${getErrorMessage(err)}`);
          this.logger.warn(`Failed to classify ${video.youtubeId}: ${err}`);
        }
      }

      batchCount++;

      // 300ms delay between batches to avoid rate limits
      if (batch.length === this.BATCH_SIZE) {
        await sleep(300);
      }
    }

    result.duration = Date.now() - startTime;

    this.logger.log(
      `Completed classification backfill: ${result.totalProcessed} processed, ` +
      `${result.classified} classified, ${result.excluded} excluded`
    );

    return result;
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
