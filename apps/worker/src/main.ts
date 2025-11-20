import dotenv from 'dotenv';
import path from 'path';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { DatabaseService } from './services/database.service';
import { YouTubeService } from './services/youtube.service';
import { SyncBandProcessor } from './processors/sync-band.processor';
import { QUEUE_NAMES, JOB_NAMES } from '@hbcu-band-hub/shared';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

class WorkerApplication {
  private database: DatabaseService;
  private youtube: YouTubeService;
  private workers: Worker[] = [];
  private redis: Redis;

  constructor() {
    this.validateEnvironment();

    // Initialize Redis connection for workers
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    // Initialize services
    this.database = new DatabaseService();
    this.youtube = new YouTubeService(
      process.env.YOUTUBE_API_KEY!,
      parseInt(process.env.YOUTUBE_QUOTA_LIMIT || '10000')
    );

    this.setupWorkers();
    this.setupGracefulShutdown();
  }

  private setupWorkers() {
    // YouTube Sync Worker - handles the jobs from your API
    const youtubeSyncWorker = new Worker(
      QUEUE_NAMES.YOUTUBE_SYNC,
      async (job) => {
        const processor = new SyncBandProcessor(this.database, this.youtube);
        
        console.log(`🎵 Processing job: ${job.name} for ${job.data.bandId || 'all bands'}`);
        
        if (job.name === JOB_NAMES.SYNC_BAND) {
          return await processor.processSingleBand(job);
        } else if (job.name === JOB_NAMES.SYNC_ALL_BANDS) {
          return await processor.processAllBands(job);
        }
        
        throw new Error(`Unknown job type: ${job.name}`);
      },
      {
        connection: this.redis,
        concurrency: 2,
      }
    );

    // Video Process Worker (for future use)
    const videoProcessWorker = new Worker(
      QUEUE_NAMES.VIDEO_PROCESS,
      async (job) => {
        console.log(`📹 Processing video job: ${job.name}`);
        // Implement video processing logic here
        return { processed: true };
      },
      {
        connection: this.redis,
        concurrency: 5,
      }
    );

    this.workers = [youtubeSyncWorker, videoProcessWorker];
    this.setupWorkerEvents();
  }

  private setupWorkerEvents() {
    this.workers.forEach((worker, index) => {
      const workerName = index === 0 ? 'YouTube Sync' : 'Video Process';

      worker.on('ready', () => {
        console.log(`🚀 ${workerName} worker is ready`);
      });

      worker.on('active', (job) => {
        console.log(`⚡ ${workerName} job ${job.id} started`);
      });

      worker.on('completed', (job, result) => {
        console.log(`✅ ${workerName} job ${job.id} completed`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ ${workerName} job ${job?.id} failed:`, err.message);
      });

      worker.on('progress', (job, progress) => {
        console.log(`📊 ${workerName} job ${job.id} progress:`, progress);
      });
    });
  }

  private validateEnvironment() {
    const required = ['YOUTUBE_API_KEY', 'DATABASE_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      process.exit(1);
    }
  }

  async start() {
    try {
      console.log('🚀 Starting HBCU Band Hub Worker...');

      await this.database.connect();

      console.log('🔍 Testing YouTube API connection...');
      const youtubeConnected = await this.youtube.testConnection();
      if (!youtubeConnected) {
        console.warn('⚠️ YouTube API connection failed - continuing anyway');
      } else {
        console.log('✅ YouTube API connection successful');
      }

      console.log('🎵 HBCU Band Hub Worker is running!');
      console.log('📊 Worker Status:');
      console.log(`  - Database: Connected`);
      console.log(`  - YouTube API: ${youtubeConnected ? 'Connected' : 'Failed'}`);
      console.log(`  - Workers: ${this.workers.length} active`);

    } catch (error) {
      console.error('❌ Failed to start worker:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupGracefulShutdown() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('💥 Unhandled Rejection:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  private async shutdown() {
    console.log('🛑 Shutting down worker...');

    try {
      // Close all workers
      await Promise.all(this.workers.map(worker => worker.close()));

      // Disconnect from database
      await this.database.disconnect();

      // Close Redis connection
      await this.redis.quit();

      console.log('✅ Worker shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Start the application
const app = new WorkerApplication();
app.start().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});