import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobState } from 'bullmq';
import { 
  QueueName, 
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
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
    @InjectQueue(QueueName.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
    @InjectQueue(QueueName.MAINTENANCE)
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
  async getQueueStats(queueName?: string): Promise<QueueStats | QueueStats[]> {
    if (queueName) {
      const queue = this.getQueue(queueName);
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }
      
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);
      
      return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      };
    }
    
    // Return all queues if no specific queue requested
    const queues = [
      { queue: this.videoSyncQueue, name: QueueName.VIDEO_SYNC },
      { queue: this.videoProcessingQueue, name: QueueName.VIDEO_PROCESSING },
      { queue: this.maintenanceQueue, name: QueueName.MAINTENANCE },
    ];
    
    const stats: QueueStats[] = [];
    
    for (const { queue, name } of queues) {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);
      
      stats.push({
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      });
    }
    
    return stats;
  }
  
  /**
   * Get job details
   */
  async getJob(queueName: string, jobId: string): Promise<JobInfo | null> {
    const queue = this.getQueue(queueName);
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
    queueName: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    limit: number = 20
  ): Promise<JobInfo[]> {
    const queue = this.getQueue(queueName);
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
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue not found: ${queueName}`);
    
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    
    await job.retry();
    this.logger.log(`Retried job ${jobId} in queue ${queueName}`);
  }
  
  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue not found: ${queueName}`);
    
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    
    await job.remove();
    this.logger.log(`Removed job ${jobId} from queue ${queueName}`);
  }
  
  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue not found: ${queueName}`);
    
    await queue.pause();
    this.logger.log(`Paused queue ${queueName}`);
  }
  
  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue not found: ${queueName}`);
    
    await queue.resume();
    this.logger.log(`Resumed queue ${queueName}`);
  }
  
  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue not found: ${queueName}`);
    
    await queue.drain();
    this.logger.log(`Drained queue ${queueName}`);
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
      case QueueName.VIDEO_SYNC:
        return this.videoSyncQueue;
      case QueueName.VIDEO_PROCESSING:
        return this.videoProcessingQueue;
      case QueueName.MAINTENANCE:
        return this.maintenanceQueue;
      default:
        return null;
    }
  }
}