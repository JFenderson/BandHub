import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { SyncBandJobData, SyncBandProcessor } from '../processors/sync-band.processor';
import { DatabaseService } from '../services/database.service';
import { YouTubeService } from '../services/youtube.service';

export class SyncQueue {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private redis: Redis;
  private processor: SyncBandProcessor;

  constructor(
    private readonly database: DatabaseService,
    private readonly youtube: YouTubeService,
    redisConfig: { host: string; port: number; password?: string }
  ) {
    // Fix: BullMQ requires maxRetriesPerRequest to be null
    this.redis = new Redis({
      ...redisConfig,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    this.processor = new SyncBandProcessor(database, youtube);

    // Initialize queue
    this.queue = new Queue('sync', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Initialize worker
    this.worker = new Worker(
      'sync',
      async (job: Job<SyncBandJobData>) => {
        return await this.processor.processSingleBand(job);
      },
      {
        connection: this.redis,
        concurrency: 2,
        limiter: {
          max: 10,
          duration: 60000,
        },
      }
    );

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents('sync', {
      connection: this.redis,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Worker events
    this.worker.on('ready', () => {
      console.log('🚀 Sync worker is ready');
    });

    this.worker.on('active', (job) => {
      console.log(`⚡ Job ${job.id} started: ${job.data.bandId}`);
    });

    this.worker.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed: ${result.savedVideos} videos saved`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      const p = progress as any;
      console.log(`📊 Job ${job.id} progress: ${p.processedVideos}/${p.totalVideos} videos`);
    });

    // Queue events
    this.queueEvents.on('waiting', ({ jobId }) => {
      console.log(`⏳ Job ${jobId} is waiting`);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      console.log(`⚠️ Job ${jobId} stalled`);
    });
  }

  // Add sync job for a single band
  async addBandSync(
    bandId: string, 
    options: {
      syncType: 'channel' | 'playlist' | 'search';
      forceSync?: boolean;
      searchQuery?: string;
      priority?: number;
      delay?: number;
    }
  ) {
    const job = await this.queue.add(
      'sync-band',
      {
        bandId,
        forceSync: options.forceSync || false,
        syncType: options.syncType,
        searchQuery: options.searchQuery,
      },
      {
        priority: options.priority || 0,
        delay: options.delay || 0,
        jobId: `sync-${bandId}-${Date.now()}`, // Unique job ID
      }
    );

    console.log(`📝 Queued sync job for band ${bandId}: ${job.id}`);
    return job;
  }

  // Add sync jobs for multiple bands
  async addBulkBandSync(
    bands: Array<{
      bandId: string;
      syncType: 'channel' | 'playlist' | 'search';
      searchQuery?: string;
    }>,
    options: { forceSync?: boolean; batchSize?: number } = {}
  ) {
    const { forceSync = false, batchSize = 10 } = options;
    
    // Process in batches to avoid overwhelming the queue
    const batches = this.chunkArray(bands, batchSize);
    const jobs = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const delay = i * 5000; // 5 second delay between batches

      for (const band of batch) {
        const job = await this.addBandSync(band.bandId, {
          syncType: band.syncType,
          searchQuery: band.searchQuery,
          forceSync,
          delay: delay,
          priority: 1, // Lower priority for bulk operations
        });
        jobs.push(job);
      }
    }

    console.log(`📦 Queued ${jobs.length} bulk sync jobs in ${batches.length} batches`);
    return jobs;
  }

  // Schedule daily sync for all active bands
  async addDailySync() {
    try {
      // Get all active bands with YouTube data
const bands = await this.database.band.findMany({
  where: {
    isActive: true,
    OR: [
      { youtubeChannelId: { not: null } },
      { 
        youtubePlaylistIds: { 
          isEmpty: false // Use isEmpty instead of not: { equals: [] }
        } 
      },
    ],
  },
  select: {
    id: true,
    name: true,
    youtubeChannelId: true,
    youtubePlaylistIds: true,
  },
});

      const syncBands = bands.map(band => ({
        bandId: band.id,
        syncType: band.youtubeChannelId ? 'channel' as const : 'playlist' as const,
      }));

      await this.addBulkBandSync(syncBands, { forceSync: false, batchSize: 5 });

      console.log(`📅 Scheduled daily sync for ${syncBands.length} bands`);
    } catch (error) {
      console.error('❌ Failed to schedule daily sync:', error);
    }
  }

  // Get queue statistics
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  // Get job details
  async getJob(jobId: string) {
    return await this.queue.getJob(jobId);
  }

  // Cancel job
  async cancelJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`🗑️ Cancelled job ${jobId}`);
    }
  }

  // Clean up old jobs
  async cleanup() {
    await this.queue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Remove completed jobs older than 24h
    await this.queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // Remove failed jobs older than 7 days
    console.log('🧹 Queue cleanup completed');
  }

  // Graceful shutdown
  async close() {
    console.log('🛑 Closing sync queue...');
    await this.worker.close();
    await this.queueEvents.close();
    await this.redis.quit();
    console.log('✅ Sync queue closed');
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}