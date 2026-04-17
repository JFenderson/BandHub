import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType, RematchVideosJobData, MatchVideosJobData, JobPriority } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface RematchResult {
  totalReset: number;
  matchJobId: string | null;
  errors: string[];
  duration: number;
}

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 1,
})
export class RematchVideosProcessor extends WorkerHost {
  private readonly logger = new Logger(RematchVideosProcessor.name);

  constructor(
    private databaseService: DatabaseService,
    @InjectQueue(QueueName.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<RematchVideosJobData>): Promise<RematchResult> {
    const { triggeredBy, filter, qualityScoreThreshold = 50, limit } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Starting video re-match (triggered by: ${triggeredBy}, filter: ${filter}, threshold: ${qualityScoreThreshold})`,
    );

    const result: RematchResult = {
      totalReset: 0,
      matchJobId: null,
      errors: [],
      duration: 0,
    };

    try {
      // Build the where clause based on filter
      const where = this.buildWhereClause(filter, qualityScoreThreshold);

      // Fetch IDs to reset (batched to avoid locking large tables)
      const videosToReset = await this.databaseService.youTubeVideo.findMany({
        where,
        select: { id: true },
        take: limit,
        orderBy: { updatedAt: 'asc' },
      });

      if (videosToReset.length === 0) {
        this.logger.log('No videos to re-match');
        result.duration = Date.now() - startTime;
        return result;
      }

      const ids = videosToReset.map((v) => v.id);
      this.logger.log(`Resetting ${ids.length} videos for re-matching...`);

      // Reset in batches of 500 to avoid timeout on large sets
      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await this.databaseService.youTubeVideo.updateMany({
          where: { id: { in: batch } },
          data: {
            bandId: null,
            opponentBandId: null,
            participantBandIds: [],
            qualityScore: 0,
            matchConfidence: 0,
            matchSource: null,
            aiProcessed: false,
            aiExtraction: null,
            aiExcluded: false,
            isPromoted: false,
            noMatchReason: null,
            matchAttemptedAt: null,
          } as any,
        });
        result.totalReset += batch.length;
      }

      this.logger.log(`Reset ${result.totalReset} videos. Enqueuing match job...`);

      // Enqueue a fresh MATCH_VIDEOS job
      const matchJobData: MatchVideosJobData = {
        type: JobType.MATCH_VIDEOS,
        triggeredBy: 'system',
        limit,
        priority: job.data.priority ?? JobPriority.NORMAL,
      };

      const matchJob = await this.videoProcessingQueue.add(
        JobType.MATCH_VIDEOS,
        matchJobData,
        {
          priority: job.data.priority ?? JobPriority.NORMAL,
          jobId: `match-videos-after-rematch-${Date.now()}`,
        },
      );

      result.matchJobId = matchJob.id ?? null;
      this.logger.log(`Match job enqueued with ID: ${result.matchJobId}`);
    } catch (error) {
      this.logger.error('Video re-match reset failed', error);
      result.errors.push(getErrorMessage(error));
      throw error;
    }

    result.duration = Date.now() - startTime;
    this.logger.log(
      `Completed re-match reset: ${result.totalReset} videos reset, match job: ${result.matchJobId}`,
    );

    return result;
  }

  private buildWhereClause(
    filter: RematchVideosJobData['filter'],
    qualityScoreThreshold: number,
  ): object {
    switch (filter) {
      case 'unmatched':
        return { bandId: null, aiExcluded: false };

      case 'low_confidence':
        return {
          matchConfidence: { lt: qualityScoreThreshold },
          matchSource: { notIn: ['MANUAL', 'CHANNEL_OWNERSHIP'] },
          bandId: { not: null },
        } as any;

      case 'alias_only':
        return { matchSource: 'ALIAS' } as any;

      case 'all':
      default:
        // Never re-process MANUAL matches
        return { matchSource: { notIn: ['MANUAL'] } } as any;
    }
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
