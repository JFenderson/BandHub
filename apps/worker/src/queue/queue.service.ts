import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { PrismaService } from '@bandhub/database';
import {
  QueueName,
  JobType,
  JobPriority,
  SyncBandJobData,
  SyncAllBandsJobData,
  ProcessVideoJobData,
  CleanupVideosJobData,
  BackfillCreatorsJobData,
  BackfillBandsJobData,
  MatchVideosJobData,
  PromoteVideosJobData,
  SyncMode,
  JobData,
} from '@hbcu-band-hub/shared-types';

/**
 * Priority rules configuration
 */
interface PriorityRule {
  condition: (data: JobData, context?: PriorityContext) => boolean;
  priority: JobPriority;
  description: string;
}

interface PriorityContext {
  isFeaturedBand?: boolean;
  isRecentVideo?: boolean;
  isBulkOperation?: boolean;
}

/**
 * Priority distribution metrics
 */
export interface PriorityDistribution {
  [JobPriority.CRITICAL]: number;
  [JobPriority.HIGH]: number;
  [JobPriority.NORMAL]: number;
  [JobPriority.LOW]: number;
  total: number;
}

export interface QueuePriorityStats {
  queueName: string;
  waiting: PriorityDistribution;
  active: PriorityDistribution;
  delayed: PriorityDistribution;
}

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private featuredBandIds: Set<string> = new Set();

  /**
   * Priority rules - evaluated in order, first match wins
   */
  private readonly priorityRules: PriorityRule[] = [
    // Featured bands get CRITICAL priority
    {
      condition: (data, context) => context?.isFeaturedBand === true,
      priority: JobPriority.CRITICAL,
      description: 'Featured band jobs',
    },
    // Recent video processing gets HIGH priority
    {
      condition: (data, context) => context?.isRecentVideo === true,
      priority: JobPriority.HIGH,
      description: 'Recent video processing',
    },
    // Bulk operations get LOW priority
    {
      condition: (data, context) => context?.isBulkOperation === true,
      priority: JobPriority.LOW,
      description: 'Bulk operations',
    },
    // Sync all bands is LOW priority (bulk op)
    {
      condition: (data) => (data as SyncAllBandsJobData).type === JobType.SYNC_ALL_BANDS,
      priority: JobPriority.LOW,
      description: 'Sync all bands',
    },
    // Cleanup operations are LOW priority
    {
      condition: (data) => (data as CleanupVideosJobData).type === JobType.CLEANUP_VIDEOS,
      priority: JobPriority.LOW,
      description: 'Cleanup operations',
    },
    // Match videos is NORMAL priority
    {
      condition: (data) => (data as MatchVideosJobData).type === JobType.MATCH_VIDEOS,
      priority: JobPriority.NORMAL,
      description: 'Match videos',
    },
    // Backfill operations are LOW priority
    {
      condition: (data) =>
        (data as BackfillCreatorsJobData).type === JobType.BACKFILL_CREATORS ||
        (data as BackfillBandsJobData).type === JobType.BACKFILL_BANDS,
      priority: JobPriority.LOW,
      description: 'Backfill operations',
    },
  ];

  constructor(
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
    @InjectQueue(QueueName.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
    @InjectQueue(QueueName.MAINTENANCE)
    private maintenanceQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.refreshFeaturedBands();
    // Refresh featured bands every 5 minutes
    setInterval(() => this.refreshFeaturedBands(), 5 * 60 * 1000);
  }

  /**
   * Refresh the cache of featured band IDs
   */
  async refreshFeaturedBands(): Promise<void> {
    try {
      const featuredBands = await this.prisma.band.findMany({
        where: { isFeatured: true },
        select: { id: true },
      });
      this.featuredBandIds = new Set(featuredBands.map(b => b.id));
      this.logger.debug(`Refreshed featured bands cache: ${this.featuredBandIds.size} bands`);
    } catch (error) {
      this.logger.error('Failed to refresh featured bands cache', error);
    }
  }

  /**
   * Check if a band is featured
   */
  isFeaturedBand(bandId: string): boolean {
    return this.featuredBandIds.has(bandId);
  }

  /**
   * Determine the priority for a job based on rules and context
   */
  determinePriority(data: JobData, context?: PriorityContext): JobPriority {
    // If priority is explicitly set in the job data, use it
    if ('priority' in data && data.priority !== undefined) {
      return data.priority;
    }

    // Build context if not provided
    const enrichedContext = context || this.buildPriorityContext(data);

    // Evaluate rules in order
    for (const rule of this.priorityRules) {
      if (rule.condition(data, enrichedContext)) {
        this.logger.debug(`Priority rule matched: ${rule.description} -> ${JobPriority[rule.priority]}`);
        return rule.priority;
      }
    }

    // Default to NORMAL priority
    return JobPriority.NORMAL;
  }

  /**
   * Build priority context from job data
   */
  private buildPriorityContext(data: JobData): PriorityContext {
    const context: PriorityContext = {};

    // Check if this is for a featured band
    if ('bandId' in data && typeof data.bandId === 'string') {
      context.isFeaturedBand = this.isFeaturedBand(data.bandId);
    }

    // Check if this is a recent video (published within last 24 hours)
    if ('rawMetadata' in data) {
      const processVideoData = data as ProcessVideoJobData;
      const publishedAt = new Date(processVideoData.rawMetadata.snippet.publishedAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      context.isRecentVideo = publishedAt > dayAgo;
    }

    // Check if this is a bulk operation
    if ('batchSize' in data || 'limit' in data) {
      const limitOrBatch = (data as any).batchSize || (data as any).limit;
      context.isBulkOperation = limitOrBatch && limitOrBatch > 10;
    }

    return context;
  }

  /**
   * Add a job with automatic priority determination
   */
  async addJobWithPriority<T extends JobData>(
    queueName: QueueName,
    jobType: JobType,
    data: T,
    options?: Partial<JobsOptions>,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const priority = this.determinePriority(data);
    const jobOptions: JobsOptions = {
      priority,
      ...options,
    };

    this.logger.log(
      `Adding job ${jobType} to ${queueName} with priority ${JobPriority[priority]} (${priority})`,
    );

    return queue.add(jobType, data, jobOptions);
  }

  /**
   * Add a sync band job with auto-prioritization
   */
  async addSyncBandJob(
    bandId: string,
    mode: SyncMode = SyncMode.INCREMENTAL,
    triggeredBy: 'admin' | 'schedule' | 'system' = 'system',
    overridePriority?: JobPriority,
  ): Promise<Job<SyncBandJobData>> {
    const data: SyncBandJobData = {
      type: JobType.SYNC_BAND,
      bandId,
      mode,
      triggeredBy,
      priority: overridePriority,
    };

    // Auto-determine priority based on featured status
    const priority = overridePriority ??
      (this.isFeaturedBand(bandId) ? JobPriority.CRITICAL : JobPriority.NORMAL);

    return this.videoSyncQueue.add(JobType.SYNC_BAND, data, {
      priority,
      jobId: `sync-${bandId}-${Date.now()}`,
    });
  }

  /**
   * Add a process video job with auto-prioritization
   */
  async addProcessVideoJob(
    data: Omit<ProcessVideoJobData, 'type' | 'priority'>,
    overridePriority?: JobPriority,
  ): Promise<Job<ProcessVideoJobData>> {
    const jobData: ProcessVideoJobData = {
      type: JobType.PROCESS_VIDEO,
      ...data,
      priority: overridePriority,
    };

    // Determine priority
    let priority = overridePriority;
    if (!priority) {
      // Featured band videos get CRITICAL priority
      if (this.isFeaturedBand(data.bandId)) {
        priority = JobPriority.CRITICAL;
      }
      // Recent videos (within 24 hours) get HIGH priority
      else {
        const publishedAt = new Date(data.rawMetadata.snippet.publishedAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        priority = publishedAt > dayAgo ? JobPriority.HIGH : JobPriority.NORMAL;
      }
    }

    return this.videoProcessingQueue.add(JobType.PROCESS_VIDEO, jobData, {
      priority,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  /**
   * Update priority of an existing job
   */
  async updateJobPriority(
    queueName: QueueName,
    jobId: string,
    newPriority: JobPriority,
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // BullMQ doesn't support changing priority of existing jobs directly
    // We need to remove and re-add the job
    const state = await job.getState();
    if (state !== 'waiting' && state !== 'delayed') {
      throw new Error(`Cannot change priority of job in state: ${state}`);
    }

    const jobData = job.data;
    const jobOpts = job.opts;

    await job.remove();

    await queue.add(job.name, jobData, {
      ...jobOpts,
      priority: newPriority,
      jobId: `${jobId}-reprioritized`,
    });

    this.logger.log(`Updated job ${jobId} priority to ${JobPriority[newPriority]}`);
  }

  /**
   * Get priority distribution metrics for all queues
   */
  async getPriorityDistribution(): Promise<QueuePriorityStats[]> {
    const queues = [
      { queue: this.videoSyncQueue, name: QueueName.VIDEO_SYNC },
      { queue: this.videoProcessingQueue, name: QueueName.VIDEO_PROCESSING },
      { queue: this.maintenanceQueue, name: QueueName.MAINTENANCE },
    ];

    const stats: QueuePriorityStats[] = [];

    for (const { queue, name } of queues) {
      const [waiting, active, delayed] = await Promise.all([
        queue.getWaiting(0, 1000),
        queue.getActive(0, 100),
        queue.getDelayed(0, 1000),
      ]);

      stats.push({
        queueName: name,
        waiting: this.calculatePriorityDistribution(waiting),
        active: this.calculatePriorityDistribution(active),
        delayed: this.calculatePriorityDistribution(delayed),
      });
    }

    return stats;
  }

  /**
   * Calculate priority distribution from a list of jobs
   */
  private calculatePriorityDistribution(jobs: Job[]): PriorityDistribution {
    const distribution: PriorityDistribution = {
      [JobPriority.CRITICAL]: 0,
      [JobPriority.HIGH]: 0,
      [JobPriority.NORMAL]: 0,
      [JobPriority.LOW]: 0,
      total: jobs.length,
    };

    for (const job of jobs) {
      const priority = job.opts?.priority || JobPriority.NORMAL;

      if (priority <= JobPriority.CRITICAL) {
        distribution[JobPriority.CRITICAL]++;
      } else if (priority <= JobPriority.HIGH) {
        distribution[JobPriority.HIGH]++;
      } else if (priority <= JobPriority.NORMAL) {
        distribution[JobPriority.NORMAL]++;
      } else {
        distribution[JobPriority.LOW]++;
      }
    }

    return distribution;
  }

  /**
   * Get aggregated priority metrics for dashboard
   */
  async getPriorityMetrics(): Promise<{
    byQueue: QueuePriorityStats[];
    totals: PriorityDistribution;
    percentages: {
      critical: number;
      high: number;
      normal: number;
      low: number;
    };
  }> {
    const byQueue = await this.getPriorityDistribution();

    // Calculate totals across all queues
    const totals: PriorityDistribution = {
      [JobPriority.CRITICAL]: 0,
      [JobPriority.HIGH]: 0,
      [JobPriority.NORMAL]: 0,
      [JobPriority.LOW]: 0,
      total: 0,
    };

    for (const queueStats of byQueue) {
      for (const state of ['waiting', 'active', 'delayed'] as const) {
        totals[JobPriority.CRITICAL] += queueStats[state][JobPriority.CRITICAL];
        totals[JobPriority.HIGH] += queueStats[state][JobPriority.HIGH];
        totals[JobPriority.NORMAL] += queueStats[state][JobPriority.NORMAL];
        totals[JobPriority.LOW] += queueStats[state][JobPriority.LOW];
        totals.total += queueStats[state].total;
      }
    }

    // Calculate percentages
    const total = totals.total || 1; // Avoid division by zero
    const percentages = {
      critical: Math.round((totals[JobPriority.CRITICAL] / total) * 100),
      high: Math.round((totals[JobPriority.HIGH] / total) * 100),
      normal: Math.round((totals[JobPriority.NORMAL] / total) * 100),
      low: Math.round((totals[JobPriority.LOW] / total) * 100),
    };

    return { byQueue, totals, percentages };
  }

  /**
   * Get queue by name
   */
  private getQueue(name: QueueName): Queue | null {
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
