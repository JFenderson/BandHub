import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { YoutubeService } from './youtube.service';
import { SyncJobType, SyncJobStatus, SyncStatus } from '@prisma/client';

// YouTube API quota costs
const QUOTA = {
  SEARCH: 100,        // Search request: 100 units
  VIDEO_LIST: 1,      // Videos.list: 1 unit per request
  CHANNEL_LIST: 1,    // Channels.list: 1 unit per request
  PLAYLIST_ITEMS: 1,  // PlaylistItems.list: 1 unit per request
  DAILY_LIMIT: 10000, // Daily quota limit
};

// Sync configuration
const SYNC_CONFIG = {
  YOUTUBE_LAUNCH_DATE: new Date('2005-04-23'),
  DEFAULT_FIRST_SYNC_YEARS: 5,
  MAX_RESULTS_PER_SEARCH: 50,
  BATCH_SIZE_FOR_VIDEO_DETAILS: 50,
  RATE_LIMIT_DELAY_MS: 1000,
};

export interface SyncOptions {
  publishedAfter?: Date;
  publishedBefore?: Date;
  maxVideos?: number;
  forceFullSync?: boolean;
}

export interface SyncResult {
  bandId: string;
  bandName: string;
  syncJobId: string;
  videosProcessed: number;
  videosAdded: number;
  videosUpdated: number;
  quotaUsed: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class YoutubeSyncService {
  private readonly logger = new Logger(YoutubeSyncService.name);
  private dailyQuotaUsed = 0;
  private quotaResetTime: Date = new Date();

  constructor(
    private readonly db: DatabaseService,
    private readonly youtubeService: YoutubeService,
  ) {
    this.resetDailyQuotaIfNeeded();
  }

  /**
   * Main sync method - intelligently selects full or incremental sync
   */
  async syncBand(bandId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    const band = await this.db.band.findUnique({ where: { id: bandId } });
    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    this.logger.log(`Starting sync for band: ${band.name} (${bandId})`);

    // Determine sync type
    const isFirstSync = !band.firstSyncedAt;
    const isFullSync = options.forceFullSync || isFirstSync;
    const jobType = isFullSync ? SyncJobType.FULL_SYNC : SyncJobType.INCREMENTAL_SYNC;

    // Create sync job record
    const syncJob = await this.db.syncJob.create({
      data: {
        bandId,
        jobType,
        status: SyncJobStatus.IN_PROGRESS,
        startedAt: new Date(),
        publishedAfter: options.publishedAfter,
        publishedBefore: options.publishedBefore,
        maxVideos: options.maxVideos,
      },
    });

    // Update band sync status
    await this.db.band.update({
      where: { id: bandId },
      data: { syncStatus: SyncStatus.IN_PROGRESS },
    });

    const result: SyncResult = {
      bandId,
      bandName: band.name,
      syncJobId: syncJob.id,
      videosProcessed: 0,
      videosAdded: 0,
      videosUpdated: 0,
      quotaUsed: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Calculate date range
      const publishedAfter = options.publishedAfter ?? (
        isFullSync 
          ? SYNC_CONFIG.YOUTUBE_LAUNCH_DATE 
          : (band.lastSyncAt ?? this.getDefaultFirstSyncDate())
      );
      const publishedBefore = options.publishedBefore ?? new Date();

      // Sync videos
      if (band.youtubeChannelId) {
        // Prefer channel-based sync for efficiency
        await this.syncFromChannel(band.id, band.youtubeChannelId, result, {
          ...options,
          publishedAfter,
          publishedBefore,
        });
      } else {
        // Fall back to search-based sync
        await this.syncFromSearch(band.id, band.name, band.schoolName, result, {
          ...options,
          publishedAfter,
          publishedBefore,
        });
      }

      // Update sync job as completed
      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.COMPLETED,
          completedAt: new Date(),
          videosFound: result.videosProcessed,
          videosAdded: result.videosAdded,
          videosUpdated: result.videosUpdated,
          quotaUsed: result.quotaUsed,
          errors: result.errors,
        },
      });

      // Update band metadata
      await this.updateBandSyncMetadata(bandId, isFullSync);

      this.logger.log(`Sync completed for ${band.name}: ${result.videosAdded} added, ${result.videosUpdated} updated`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);

      // Update sync job as failed
      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          completedAt: new Date(),
          videosFound: result.videosProcessed,
          videosAdded: result.videosAdded,
          videosUpdated: result.videosUpdated,
          quotaUsed: result.quotaUsed,
          errors: result.errors,
          errorMessage,
        },
      });

      // Update band sync status
      await this.db.band.update({
        where: { id: bandId },
        data: { syncStatus: SyncStatus.FAILED },
      });

      this.logger.error(`Sync failed for ${band.name}: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync videos from a YouTube channel (more efficient)
   */
  async syncFromChannel(
    bandId: string,
    channelId: string,
    result: SyncResult,
    options: SyncOptions = {},
  ): Promise<void> {
    this.logger.log(`Syncing from channel: ${channelId}`);

    try {
      const videos = await this.youtubeService.getChannelVideos(
        channelId,
        options.maxVideos || SYNC_CONFIG.MAX_RESULTS_PER_SEARCH,
      );

      // Estimate quota usage for this operation
      const operationQuota = 
        QUOTA.CHANNEL_LIST + 
        QUOTA.PLAYLIST_ITEMS * Math.ceil(videos.length / 50) +
        QUOTA.VIDEO_LIST * Math.ceil(videos.length / SYNC_CONFIG.BATCH_SIZE_FOR_VIDEO_DETAILS);
      result.quotaUsed += operationQuota;
      this.dailyQuotaUsed += operationQuota;

      for (const video of videos) {
        // Filter by date if specified
        if (options.publishedAfter && video.publishedAt < options.publishedAfter) {
          continue;
        }
        if (options.publishedBefore && video.publishedAt > options.publishedBefore) {
          continue;
        }

        result.videosProcessed++;

        try {
          await this.upsertVideo(bandId, video, result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to upsert video ${video.youtubeId}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Channel sync failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Sync videos using YouTube search API (fallback)
   */
  async syncFromSearch(
    bandId: string,
    bandName: string,
    schoolName: string,
    result: SyncResult,
    options: SyncOptions = {},
  ): Promise<void> {
    const searchQueries = this.generateSearchQueries(bandName, schoolName);
    
    this.logger.log(`Syncing from search with ${searchQueries.length} queries`);

    for (const query of searchQueries) {
      // Check quota before each search
      if (!this.checkQuotaAvailable(QUOTA.SEARCH)) {
        this.logger.warn('Daily quota limit reached, stopping sync');
        result.errors.push('Daily quota limit reached');
        break;
      }

      try {
        const videos = await this.youtubeService.searchVideosForBand(
          bandId,
          [query],
          options.maxVideos || SYNC_CONFIG.MAX_RESULTS_PER_SEARCH,
        );

        // Calculate quota usage for this search operation
        const searchQuota = QUOTA.SEARCH + QUOTA.VIDEO_LIST * Math.ceil(videos.length / SYNC_CONFIG.BATCH_SIZE_FOR_VIDEO_DETAILS);
        result.quotaUsed += searchQuota;
        this.dailyQuotaUsed += searchQuota;

        for (const video of videos) {
          // Filter by date if specified
          if (options.publishedAfter && video.publishedAt < options.publishedAfter) {
            continue;
          }
          if (options.publishedBefore && video.publishedAt > options.publishedBefore) {
            continue;
          }

          result.videosProcessed++;

          try {
            await this.upsertVideo(bandId, video, result);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to upsert video ${video.youtubeId}: ${errorMsg}`);
          }
        }

        // Rate limiting between searches
        await this.delay(SYNC_CONFIG.RATE_LIMIT_DELAY_MS);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Search query "${query}" failed: ${errorMsg}`);
      }
    }
  }

  /**
   * Trigger a complete historical sync for a band
   */
  async fullBackfill(bandId: string): Promise<SyncResult> {
    return this.syncBand(bandId, {
      forceFullSync: true,
      publishedAfter: SYNC_CONFIG.YOUTUBE_LAUNCH_DATE,
      publishedBefore: new Date(),
    });
  }

  /**
   * Sync all bands incrementally (for scheduled jobs)
   */
  async syncAllBandsIncremental(): Promise<SyncResult[]> {
    const bands = await this.db.band.findMany({
      where: { isActive: true },
      orderBy: { lastSyncAt: 'asc' },
    });

    this.logger.log(`Starting incremental sync for ${bands.length} bands`);

    const results: SyncResult[] = [];

    for (const band of bands) {
      if (!this.checkQuotaAvailable(QUOTA.SEARCH * 3)) {
        this.logger.warn('Insufficient quota for remaining bands');
        break;
      }

      try {
        const result = await this.syncBand(band.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to sync band ${band.name}: ${error}`);
      }

      // Rate limiting between bands
      await this.delay(SYNC_CONFIG.RATE_LIMIT_DELAY_MS * 5);
    }

    return results;
  }

  /**
   * Get bands that need a full historical sync
   */
  async getBandsNeedingFullSync(): Promise<{ id: string; name: string; lastFullSync: Date | null }[]> {
    const bands = await this.db.band.findMany({
      where: {
        isActive: true,
        OR: [
          { lastFullSync: null },
          { firstSyncedAt: null },
        ],
      },
      select: {
        id: true,
        name: true,
        lastFullSync: true,
      },
    });

    return bands;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    this.resetDailyQuotaIfNeeded();

    const [totalBands, syncedBands, totalVideos, recentJobs] = await Promise.all([
      this.db.band.count({ where: { isActive: true } }),
      this.db.band.count({ where: { isActive: true, firstSyncedAt: { not: null } } }),
      this.db.video.count(),
      this.db.syncJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { band: { select: { name: true } } },
      }),
    ]);

    return {
      totalBands,
      syncedBands,
      unsyncedBands: totalBands - syncedBands,
      totalVideos,
      dailyQuotaUsed: this.dailyQuotaUsed,
      dailyQuotaRemaining: QUOTA.DAILY_LIMIT - this.dailyQuotaUsed,
      quotaResetTime: this.quotaResetTime,
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        bandName: job.band?.name ?? 'All Bands',
        jobType: job.jobType,
        status: job.status,
        videosAdded: job.videosAdded,
        quotaUsed: job.quotaUsed,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    };
  }

  /**
   * Get detailed sync status for a band
   */
  async getBandSyncStatus(bandId: string) {
    const band = await this.db.band.findUnique({
      where: { id: bandId },
      include: {
        syncJobs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    return {
      bandId: band.id,
      bandName: band.name,
      youtubeChannelId: band.youtubeChannelId,
      syncStatus: band.syncStatus,
      lastSyncAt: band.lastSyncAt,
      firstSyncedAt: band.firstSyncedAt,
      lastFullSync: band.lastFullSync,
      earliestVideoDate: band.earliestVideoDate,
      latestVideoDate: band.latestVideoDate,
      totalVideoCount: band._count.videos,
      recentSyncJobs: band.syncJobs,
    };
  }

  // Private helper methods

  private async upsertVideo(
    bandId: string,
    video: {
      youtubeId: string;
      title: string;
      description: string;
      thumbnailUrl: string;
      publishedAt: Date;
      duration: number;
      viewCount: number;
    },
    result: SyncResult,
  ): Promise<void> {
    const existing = await this.db.video.findUnique({
      where: { youtubeId: video.youtubeId },
    });

    if (existing) {
      // Update existing video with latest stats
      await this.db.video.update({
        where: { id: existing.id },
        data: {
          viewCount: video.viewCount,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
        },
      });
      result.videosUpdated++;
    } else {
      // Create new video
      await this.db.video.create({
        data: {
          youtubeId: video.youtubeId,
          title: video.title,
          description: video.description || '',
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          duration: video.duration,
          viewCount: video.viewCount,
          bandId,
        },
      });
      result.videosAdded++;
    }
  }

  private async updateBandSyncMetadata(bandId: string, isFullSync: boolean): Promise<void> {
    const now = new Date();

    // Get video date range
    const [earliestVideo, latestVideo, videoCount] = await Promise.all([
      this.db.video.findFirst({
        where: { bandId },
        orderBy: { publishedAt: 'asc' },
        select: { publishedAt: true },
      }),
      this.db.video.findFirst({
        where: { bandId },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      }),
      this.db.video.count({ where: { bandId } }),
    ]);

    const updateData: Record<string, unknown> = {
      lastSyncAt: now,
      syncStatus: SyncStatus.COMPLETED,
      earliestVideoDate: earliestVideo?.publishedAt,
      latestVideoDate: latestVideo?.publishedAt,
      totalVideoCount: videoCount,
    };

    // Set firstSyncedAt only on first sync
    const band = await this.db.band.findUnique({ where: { id: bandId } });
    if (!band?.firstSyncedAt) {
      updateData.firstSyncedAt = now;
    }

    if (isFullSync) {
      updateData.lastFullSync = now;
    }

    await this.db.band.update({
      where: { id: bandId },
      data: updateData,
    });
  }

  private generateSearchQueries(bandName: string, schoolName: string): string[] {
    return [
      `${bandName} marching band`,
      `${schoolName} marching band`,
      `${bandName} HBCU`,
      `${schoolName} halftime show`,
      `${bandName} field show`,
    ];
  }

  private getDefaultFirstSyncDate(): Date {
    const yearsAgo = new Date();
    yearsAgo.setFullYear(yearsAgo.getFullYear() - SYNC_CONFIG.DEFAULT_FIRST_SYNC_YEARS);
    return yearsAgo;
  }

  private checkQuotaAvailable(requiredQuota: number): boolean {
    this.resetDailyQuotaIfNeeded();
    return this.dailyQuotaUsed + requiredQuota <= QUOTA.DAILY_LIMIT;
  }

  private resetDailyQuotaIfNeeded(): void {
    const now = new Date();
    
    // YouTube API quota resets at midnight Pacific Time
    // Calculate current Pacific time by using UTC offset
    // Pacific is UTC-8 (PST) or UTC-7 (PDT)
    const pacificOffset = this.getPacificOffset(now);
    const pacificNow = new Date(now.getTime() + pacificOffset);
    
    // Calculate midnight Pacific time in UTC
    const pacificMidnightToday = new Date(pacificNow);
    pacificMidnightToday.setHours(0, 0, 0, 0);
    const utcMidnightPacific = new Date(pacificMidnightToday.getTime() - pacificOffset);

    if (now >= this.quotaResetTime) {
      this.dailyQuotaUsed = 0;
      // Set next reset time to next Pacific midnight
      this.quotaResetTime = new Date(utcMidnightPacific.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private getPacificOffset(date: Date): number {
    // Check if date is in DST (PDT: UTC-7) or PST (UTC-8)
    // DST in US: Second Sunday in March to First Sunday in November
    const year = date.getUTCFullYear();
    const marchSecondSunday = this.getNthSundayOfMonth(year, 2, 2); // March, 2nd Sunday
    const novFirstSunday = this.getNthSundayOfMonth(year, 10, 1); // November, 1st Sunday
    
    const isDST = date >= marchSecondSunday && date < novFirstSunday;
    return isDST ? -7 * 60 * 60 * 1000 : -8 * 60 * 60 * 1000;
  }

  private getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const date = new Date(Date.UTC(year, month, 1, 10, 0, 0)); // 10 AM UTC (2 AM Pacific)
    const dayOfWeek = date.getUTCDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    date.setUTCDate(firstSunday + (n - 1) * 7);
    return date;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
