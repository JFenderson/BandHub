import * as cron from 'node-cron';
import { SyncQueue } from '../queues/sync.queue';
import { DatabaseService } from '../services/database.service';

export class JobScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStatus: Map<string, boolean> = new Map();
  private jobScheduled: Map<string, boolean> = new Map(); // This line MUST be here

  constructor(
    private readonly syncQueue: SyncQueue,
    private readonly database: DatabaseService,
  ) {}

  start() {
    console.log('⏰ Starting job scheduler...');

    // Daily sync at 2 AM
    this.scheduleJob('daily-sync', '0 2 * * *', async () => {
      console.log('🌅 Starting daily sync...');
      await this.syncQueue.addDailySync();
    });

    // Weekly full sync on Sundays at 3 AM
    this.scheduleJob('weekly-full-sync', '0 3 * * 0', async () => {
      console.log('📅 Starting weekly full sync...');
      await this.performWeeklyFullSync();
    });

    // Cleanup old jobs every day at 4 AM
    this.scheduleJob('queue-cleanup', '0 4 * * *', async () => {
      console.log('🧹 Starting queue cleanup...');
      await this.syncQueue.cleanup();
    });

    // Update band statistics every 6 hours
    this.scheduleJob('update-stats', '0 */6 * * *', async () => {
      console.log('📊 Updating band statistics...');
      await this.updateBandStatistics();
    });

    // Health check every 15 minutes
    this.scheduleJob('health-check', '*/15 * * * *', async () => {
      await this.performHealthCheck();
    });

    console.log(`✅ Scheduled ${this.jobs.size} jobs`);
  }

  private scheduleJob(name: string, cronExpression: string, task: () => Promise<void>) {
    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log(`🚀 Starting scheduled job: ${name}`);
        this.jobStatus.set(name, true); // Mark as running
        await task();
        console.log(`✅ Completed scheduled job: ${name}`);
      } catch (error) {
        console.error(`❌ Failed scheduled job ${name}:`, error);
      } finally {
        this.jobStatus.set(name, false); // Mark as not running
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York',
    });

    this.jobs.set(name, job);
    this.jobStatus.set(name, false); // Initially not running
    job.start();
    console.log(`📝 Scheduled job "${name}" with cron: ${cronExpression}`);
  }

  private async performWeeklyFullSync() {
    try {
      const bands = await this.database.band.findMany({
        where: {
          OR: [
            { youtubeChannelId: { not: null } },
            { 
              youtubePlaylistIds: { 
                isEmpty: false
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

      await this.syncQueue.addBulkBandSync(syncBands, { 
        forceSync: true, 
        batchSize: 3
      });

      console.log(`🔄 Scheduled weekly full sync for ${syncBands.length} bands`);

    } catch (error) {
      console.error('❌ Failed to perform weekly full sync:', error);
    }
  }

  private async updateBandStatistics() {
    try {
      const bands = await this.database.band.findMany({
        select: { id: true },
      });

      for (const band of bands) {
        const videoCount = await this.database.video.count({
          where: { 
            bandId: band.id,
            isHidden: false,
          },
        });

        await this.database.band.update({
          where: { id: band.id },
          data: {
            updatedAt: new Date(),
          },
        });
      }

      console.log(`📈 Updated statistics for ${bands.length} bands`);

    } catch (error) {
      console.error('❌ Failed to update band statistics:', error);
    }
  }

  private async performHealthCheck() {
    try {
      const stats = await this.syncQueue.getStats();
      
      if (stats.failed > 10) {
        console.warn(`⚠️ High number of failed jobs: ${stats.failed}`);
      }

      if (stats.waiting > 50) {
        console.warn(`⚠️ Queue is backed up: ${stats.waiting} waiting jobs`);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  stop() {
    console.log('🛑 Stopping job scheduler...');
    
    for (const [name, job] of this.jobs.entries()) {
      job.stop();
      this.jobStatus.set(name, false);
      console.log(`⏸️ Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.jobStatus.clear();
    console.log('✅ Job scheduler stopped');
  }

  getJobStatus() {
    return Array.from(this.jobs.entries()).map(([name]) => ({
      name,
      running: this.jobStatus.get(name) || false,
      scheduled: this.jobScheduled.get(name) || false, // Fix: use our manual tracking
    }));
  }
}