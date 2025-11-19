import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@hbcu-band-hub/shared';

export interface SyncBandJobData {
  bandId: string;
  syncType: 'full' | 'incremental';
}

export interface ProcessVideoJobData {
  videoId: string;
  youtubeId: string;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.YOUTUBE_SYNC)
    private youtubeSyncQueue: Queue,

    @InjectQueue(QUEUE_NAMES.VIDEO_PROCESS)
    private videoProcessQueue: Queue,
  ) {}

  async addSyncBandJob(data: SyncBandJobData) {
    return this.youtubeSyncQueue.add(JOB_NAMES.SYNC_BAND, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs for debugging
    });
  }

  async addSyncAllBandsJob() {
    return this.youtubeSyncQueue.add(
      JOB_NAMES.SYNC_ALL_BANDS,
      {},
      {
        attempts: 1,
        removeOnComplete: 10,
      },
    );
  }

  async addProcessVideoJob(data: ProcessVideoJobData) {
    return this.videoProcessQueue.add(JOB_NAMES.PROCESS_VIDEO, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
    });
  }

  async getQueueStats(queueName: string) {
    const queue = queueName === QUEUE_NAMES.YOUTUBE_SYNC 
      ? this.youtubeSyncQueue 
      : this.videoProcessQueue;

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}