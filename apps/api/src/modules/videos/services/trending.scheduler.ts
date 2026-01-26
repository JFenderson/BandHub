import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrendingService } from './trending.service';

/**
 * TrendingScheduler - Manages scheduled updates of trending video cache
 *
 * Runs every hour to refresh the trending cache, ensuring users always
 * see fresh trending content without waiting for cache expiration.
 */
@Injectable()
export class TrendingScheduler {
  private readonly logger = new Logger(TrendingScheduler.name);
  private isRunning = false;

  constructor(private readonly trendingService: TrendingService) {}

  /**
   * Refresh trending cache every hour
   * Runs at minute 0 of every hour
   */
  @Cron('0 * * * *', {
    name: 'refresh-trending-videos',
    timeZone: 'America/New_York',
  })
  async refreshTrendingCache() {
    if (this.isRunning) {
      this.logger.warn('Trending refresh already in progress, skipping scheduled run');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled trending cache refresh');

    try {
      await this.trendingService.refreshTrendingCache();
      this.logger.log('Scheduled trending cache refresh completed');
    } catch (error) {
      this.logger.error('Scheduled trending cache refresh failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      schedule: {
        name: 'refresh-trending-videos',
        description: 'Refreshes trending video cache',
        cron: '0 * * * *',
        frequency: 'Every hour at minute 0',
      },
    };
  }

  /**
   * Manually trigger a refresh (for admin use)
   */
  async triggerManualRefresh(): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Refresh already in progress',
      };
    }

    this.isRunning = true;
    try {
      await this.trendingService.refreshTrendingCache();
      return {
        success: true,
        message: 'Trending cache refresh completed',
      };
    } catch (error) {
      return {
        success: false,
        message: `Refresh failed: ${error.message}`,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
