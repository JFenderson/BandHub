import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { YoutubeSyncService } from './youtube-sync.service';

/**
 * YouTube Sync Scheduler
 * 
 * Handles automated scheduling of video synchronization:
 * - Incremental sync every 12 hours (fetches new videos)
 * - Quarterly deep sync reminder (manual trigger recommended)
 */
@Injectable()
export class YoutubeSyncScheduler {
  private readonly logger = new Logger(YoutubeSyncScheduler.name);
  private isRunning = false;

  constructor(private readonly youtubeSyncService: YoutubeSyncService) {}

  /**
   * Incremental sync - runs every 12 hours at 6 AM and 6 PM Eastern
   * This syncs only new videos published since the last sync
   */
  @Cron('0 6,18 * * *', {
    name: 'incremental-sync',
    timeZone: 'America/New_York',
  })
  async runIncrementalSync() {
    if (this.isRunning) {
      this.logger.warn('Sync already in progress, skipping scheduled run');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled incremental sync');

    try {
      const results = await this.youtubeSyncService.syncAllBandsIncremental();
      
      const totalAdded = results.reduce((sum, r) => sum + r.videosAdded, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.videosUpdated, 0);
      const totalQuota = results.reduce((sum, r) => sum + r.quotaUsed, 0);
      
      this.logger.log(
        `Incremental sync completed: ${results.length} bands, ` +
        `${totalAdded} videos added, ${totalUpdated} updated, ` +
        `${totalQuota} quota used`
      );
    } catch (error) {
      this.logger.error('Incremental sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Quarterly deep sync reminder - runs first day of each quarter
   * Logs a reminder to run manual backfill for historical coverage
   */
  @Cron('0 9 1 1,4,7,10 *', {
    name: 'quarterly-sync-reminder',
    timeZone: 'America/New_York',
  })
  async quarterlyDeepSyncReminder() {
    this.logger.log('='.repeat(60));
    this.logger.log('📅 QUARTERLY DEEP SYNC REMINDER');
    this.logger.log('='.repeat(60));
    
    try {
      const stats = await this.youtubeSyncService.getSyncStats();
      const bandsNeedingSync = await this.youtubeSyncService.getBandsNeedingFullSync();

      this.logger.log(`Total bands: ${stats.totalBands}`);
      this.logger.log(`Synced bands: ${stats.syncedBands}`);
      this.logger.log(`Bands needing full sync: ${bandsNeedingSync.length}`);
      this.logger.log(`Total videos: ${stats.totalVideos}`);
      
      if (bandsNeedingSync.length > 0) {
        this.logger.log('');
        this.logger.log('Bands needing full sync:');
        bandsNeedingSync.slice(0, 10).forEach((band) => {
          this.logger.log(`  - ${band.name}`);
        });
        if (bandsNeedingSync.length > 10) {
          this.logger.log(`  ... and ${bandsNeedingSync.length - 10} more`);
        }
        this.logger.log('');
        this.logger.log('Run: npm run backfill');
      }
    } catch (error) {
      this.logger.error('Failed to get sync status:', error);
    }

    this.logger.log('='.repeat(60));
  }

  /**
   * Daily quota reset check - runs at midnight Pacific
   * Useful for logging daily sync summary
   */
  @Cron('0 0 * * *', {
    name: 'daily-summary',
    timeZone: 'America/Los_Angeles',
  })
  async dailySummary() {
    try {
      const stats = await this.youtubeSyncService.getSyncStats();
      
      this.logger.log('='.repeat(40));
      this.logger.log('📊 DAILY SYNC SUMMARY');
      this.logger.log('='.repeat(40));
      this.logger.log(`Quota used today: ${stats.dailyQuotaUsed}/${10000}`);
      this.logger.log(`Total videos: ${stats.totalVideos}`);
      this.logger.log(`Recent jobs: ${stats.recentJobs.length}`);
      this.logger.log('='.repeat(40));
    } catch (error) {
      this.logger.error('Failed to generate daily summary:', error);
    }
  }

  /**
   * Get current scheduler status
   */
  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      schedules: [
        {
          name: 'incremental-sync',
          schedule: 'Every 12 hours at 6 AM/PM Eastern',
          cron: '0 6,18 * * *',
        },
        {
          name: 'quarterly-reminder',
          schedule: 'First day of each quarter at 9 AM Eastern',
          cron: '0 9 1 1,4,7,10 *',
        },
        {
          name: 'daily-summary',
          schedule: 'Midnight Pacific (quota reset)',
          cron: '0 0 * * *',
        },
      ],
    };
  }
}
