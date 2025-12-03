import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobState } from 'bullmq';
import {
  QUEUE_NAMES,
  JobType,
  SyncBandJobData,
  SyncAllBandsJobData,
  CleanupVideosJobData,
  SyncMode,
  JobPriority,
} from '@hbcu-band-hub/shared-types';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobInfo {
  id: string;
  name: string;
  data: any;
  progress: number | object;  // Changed to match BullMQ's type
  state: JobState | "unknown";
  attempts: number;
  failedReason?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.YOUTUBE_SYNC)
    private youtubeSyncQueue: Queue,
    
    @InjectQueue(QUEUE_NAMES.YOUTUBE_SYNC)
    private videoSyncQueue: Queue,
    
    @InjectQueue(QUEUE_NAMES.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
    
    @InjectQueue(QUEUE_NAMES.MAINTENANCE)
    private maintenanceQueue: Queue,
  ) {}
  
  /**
   * Trigger sync for a specific band
   */
  async syncBand(
    bandId: string,
    mode: SyncMode = SyncMode.INCREMENTAL,
    priority: JobPriority = JobPriority.HIGH
  ): Promise<Job> {
    this.logger.log(`Queueing sync for band ${bandId} (mode: ${mode})`);
    
    return this.videoSyncQueue.add(
      JobType.SYNC_BAND,
      {
        type: JobType.SYNC_BAND,
        bandId,
        mode,
        triggeredBy: 'admin',
      } as SyncBandJobData,
      {
        priority,
        jobId: `manual-sync-${bandId}-${Date.now()}`,
      }
    );
  }

  /**
   * Pause all managed queues (useful during shutdown)
   */
  async pauseAllQueues(): Promise<void> {
    const queues = [this.youtubeSyncQueue, this.videoProcessingQueue, this.maintenanceQueue];
    await Promise.all(queues.map((q) => q.pause()));
    this.logger.log('Paused all queues');
  }

  /**
   * Resume all managed queues
   */
  async resumeAllQueues(): Promise<void> {
    const queues = [this.youtubeSyncQueue, this.videoProcessingQueue, this.maintenanceQueue];
    await Promise.all(queues.map((q) => q.resume()));
    this.logger.log('Resumed all queues');
  }
  
  /**
   * Trigger sync for all bands
   */
  async syncAllBands(
    mode: SyncMode = SyncMode.INCREMENTAL,
    batchSize: number = 5
  ): Promise<Job> {
    this.logger.log(`Queueing sync for all bands (mode: ${mode})`);
    
    return this.videoSyncQueue.add(
      JobType.SYNC_ALL_BANDS,
      {
        type: JobType.SYNC_ALL_BANDS,
        mode,
        triggeredBy: 'admin',
        batchSize,
      } as SyncAllBandsJobData,
      {
        priority: JobPriority.CRITICAL,
        jobId: `manual-sync-all-${Date.now()}`,
      }
    );
  }
  
  /**
   * Trigger cleanup job
   */
  async cleanup(
    scope: 'duplicates' | 'irrelevant' | 'deleted' | 'all',
    dryRun: boolean = false
  ): Promise<Job> {
    this.logger.log(`Queueing cleanup (scope: ${scope}, dryRun: ${dryRun})`);
    
    return this.maintenanceQueue.add(
      JobType.CLEANUP_VIDEOS,
      {
        type: JobType.CLEANUP_VIDEOS,
        scope,
        dryRun,
      } as CleanupVideosJobData,
      {
        priority: JobPriority.NORMAL,
        jobId: `manual-cleanup-${Date.now()}`,
      }
    );
  }
  
  /**
   * Get queue statistics - supports both single queue and all queues
   */
  async getAllQueues() {
  const queues = [
    { queue: this.youtubeSyncQueue, name: QUEUE_NAMES.YOUTUBE_SYNC },
    { queue: this.videoProcessingQueue, name: QUEUE_NAMES.VIDEO_PROCESSING },
    { queue: this.maintenanceQueue, name: QUEUE_NAMES.MAINTENANCE },
  ];

  const stats = await Promise.all(
    queues.map(async ({ queue, name }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    }),
  );

  return stats;
}
  
  /**
   * Get job details
   */
  async getJob(QUEUE_NAMES: string, jobId: string): Promise<JobInfo | null> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) return null;
    
    const job = await queue.getJob(jobId);
    if (!job) return null;
    
    const state = await job.getState();
    
    return {
      id: job.id!,
      name: job.name,
      data: job.data,
      progress: typeof job.progress === 'object' ? job.progress : (typeof job.progress === 'number' ? job.progress : (job.progress ? 100 : 0)),
      state,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }
  
  /**
   * Get recent jobs from a queue
   */
  async getJobs(
    QUEUE_NAMES: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    limit: number = 20
  ): Promise<JobInfo[]> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) return [];
    
    let jobs: Job[];
    switch (status) {
      case 'waiting':
        jobs = await queue.getWaiting(0, limit - 1);
        break;
      case 'active':
        jobs = await queue.getActive(0, limit - 1);
        break;
      case 'completed':
        jobs = await queue.getCompleted(0, limit - 1);
        break;
      case 'failed':
        jobs = await queue.getFailed(0, limit - 1);
        break;
      case 'delayed':
        jobs = await queue.getDelayed(0, limit - 1);
        break;
      default:
        jobs = [];
    }
    
    return Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        return {
          id: job.id!,
          name: job.name,
          data: job.data,
          progress: typeof job.progress === 'object' ? job.progress : (typeof job.progress === 'number' ? job.progress : 0),
          state,
          attempts: job.attemptsMade,
          failedReason: job.failedReason,
          createdAt: new Date(job.timestamp),
          processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        };
      })
    );
  }
  
  /**
   * Retry a failed job
   */
  async retryJob(QUEUE_NAMES: string, jobId: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) throw new Error(`Queue not found: ${QUEUE_NAMES}`);
    
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    
    await job.retry();
    this.logger.log(`Retried job ${jobId} in queue ${QUEUE_NAMES}`);
  }
  
  /**
   * Remove a job
   */
  async removeJob(QUEUE_NAMES: string, jobId: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) throw new Error(`Queue not found: ${QUEUE_NAMES}`);
    
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    
    await job.remove();
    this.logger.log(`Removed job ${jobId} from queue ${QUEUE_NAMES}`);
  }
  
  /**
   * Pause a queue
   */
  async pauseQueue(QUEUE_NAMES: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) throw new Error(`Queue not found: ${QUEUE_NAMES}`);
    
    await queue.pause();
    this.logger.log(`Paused queue ${QUEUE_NAMES}`);
  }
  
  /**
   * Resume a queue
   */
  async resumeQueue(QUEUE_NAMES: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) throw new Error(`Queue not found: ${QUEUE_NAMES}`);
    
    await queue.resume();
    this.logger.log(`Resumed queue ${QUEUE_NAMES}`);
  }
  
  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(QUEUE_NAMES: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES);
    if (!queue) throw new Error(`Queue not found: ${QUEUE_NAMES}`);
    
    await queue.drain();
    this.logger.log(`Drained queue ${QUEUE_NAMES}`);
  }
  
  /**
   * Legacy method name - maps to syncBand
   */
  async addSyncBandJob(data: { bandId: string; syncType: 'full' | 'incremental' }): Promise<Job> {
    const mode = data.syncType === 'full' ? SyncMode.FULL : SyncMode.INCREMENTAL;
    return this.syncBand(data.bandId, mode, JobPriority.HIGH);
  }

  /**
   * Legacy method name - maps to syncAllBands
   */
  async addSyncAllBandsJob(): Promise<Job> {
    return this.syncAllBands(SyncMode.INCREMENTAL, 5);
  }
  
  private getQueue(name: string): Queue | null {
    switch (name) {
      case QUEUE_NAMES.YOUTUBE_SYNC:
        return this.videoSyncQueue;
      case QUEUE_NAMES.VIDEO_PROCESSING:
        return this.videoProcessingQueue;
      case QUEUE_NAMES.MAINTENANCE:
        return this.maintenanceQueue;
      default:
        return null;
    }
  }
}