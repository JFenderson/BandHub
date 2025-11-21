import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { 
  QueueName, 
  JobType, 
  SyncAllBandsJobData, 
  CleanupVideosJobData,
  SyncMode,
  JobPriority,
} from '@hbcu-band-hub/shared/types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);
  private readonly isProduction: boolean;
  
  constructor(
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
    @InjectQueue(QueueName.MAINTENANCE)
    private maintenanceQueue: Queue,
    private configService: ConfigService,
  ) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
  }
  
  /**
   * Run on startup to ensure scheduled jobs are configured
   */
  async onModuleInit() {
    this.logger.log('Sync scheduler initialized');
    
    // Remove any stale repeatable jobs from previous deployments
    await this.cleanupStaleJobs();
    
    // Log next scheduled runs
    this.logSchedule();
  }
  
  /**
   * Daily incremental sync - runs every day at 3 AM UTC
   * This catches new videos published since the last sync
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyIncrementalSync() {
    if (!this.isProduction) {
      this.logger.debug('Skipping daily sync in non-production environment');
      return;
    }
    
    this.logger.log('Starting daily incremental sync');
    
    await this.videoSyncQueue.add(
      JobType.SYNC_ALL_BANDS,
      {
        type: JobType.SYNC_ALL_BANDS,
        mode: SyncMode.INCREMENTAL,
        triggeredBy: 'schedule',
        batchSize: 5,
      } as SyncAllBandsJobData,
      {
        priority: JobPriority.NORMAL,
        jobId: `daily-sync-${new Date().toISOString().split('T')[0]}`,
      }
    );
  }
  
  /**
   * Weekly full sync - runs every Sunday at 2 AM UTC
   * This catches any videos that might have been missed
   */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyFullSync() {
    if (!this.isProduction) {
      this.logger.debug('Skipping weekly sync in non-production environment');
      return;
    }
    
    this.logger.log('Starting weekly full sync');
    
    await this.videoSyncQueue.add(
      JobType.SYNC_ALL_BANDS,
      {
        type: JobType.SYNC_ALL_BANDS,
        mode: SyncMode.FULL,
        triggeredBy: 'schedule',
        batchSize: 3,  // Smaller batches for full sync
      } as SyncAllBandsJobData,
      {
        priority: JobPriority.LOW,  // Lower priority than daily sync
        jobId: `weekly-sync-${new Date().toISOString().split('T')[0]}`,
      }
    );
  }
  
  /**
   * Daily cleanup - runs every day at 4 AM UTC
   * This removes duplicates and hides irrelevant videos
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async dailyCleanup() {
    if (!this.isProduction) {
      this.logger.debug('Skipping daily cleanup in non-production environment');
      return;
    }
    
    this.logger.log('Starting daily cleanup');
    
    await this.maintenanceQueue.add(
      JobType.CLEANUP_VIDEOS,
      {
        type: JobType.CLEANUP_VIDEOS,
        scope: 'all',
        dryRun: false,
      } as CleanupVideosJobData,
      {
        priority: JobPriority.LOW,
        jobId: `cleanup-${new Date().toISOString().split('T')[0]}`,
      }
    );
  }
  
  /**
   * Hourly stats update - runs every hour
   * Updates view counts and likes for recent videos
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyStatsUpdate() {
    // Only run in production and only during peak hours (9 AM - 11 PM UTC)
    if (!this.isProduction) return;
    
    const hour = new Date().getUTCHours();
    if (hour < 9 || hour > 23) return;
    
    this.logger.log('Starting hourly stats update');
    
    await this.videoSyncQueue.add(
      JobType.UPDATE_STATS,
      {
        type: JobType.UPDATE_STATS,
        batchSize: 100,
      },
      {
        priority: JobPriority.LOW,
        jobId: `stats-${new Date().toISOString()}`,
      }
    );
  }
  
  /**
   * Remove any orphaned repeatable jobs
   */
  private async cleanupStaleJobs() {
    const repeatableJobs = await this.videoSyncQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.videoSyncQueue.removeRepeatableByKey(job.key);
    }
    
    const maintenanceRepeatableJobs = await this.maintenanceQueue.getRepeatableJobs();
    for (const job of maintenanceRepeatableJobs) {
      await this.maintenanceQueue.removeRepeatableByKey(job.key);
    }
  }
  
  private logSchedule() {
    this.logger.log('Scheduled jobs:');
    this.logger.log('  - Daily incremental sync: 3:00 AM UTC');
    this.logger.log('  - Weekly full sync: Sundays at 2:00 AM UTC');
    this.logger.log('  - Daily cleanup: 4:00 AM UTC');
    this.logger.log('  - Hourly stats update: Every hour (9 AM - 11 PM UTC)');
  }
}