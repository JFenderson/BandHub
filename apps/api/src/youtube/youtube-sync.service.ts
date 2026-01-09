import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService} from '@bandhub/database';
import { YoutubeService } from './youtube.service';
import { YoutubeQuotaService } from './youtube-quota.service';
import { SyncJobType, SyncJobStatus, SyncStatus } from '@prisma/client';
import { 
  YouTubeOperation, 
  SyncPriority,
  QUOTA_COSTS,
} from './interfaces/quota.interface';

/**
 * YouTube Sync Service with Integrated Quota Management
 * 
 * File: apps/api/src/youtube/youtube-sync.service.ts (UPDATED)
 * 
 * Changes from original:
 * 1. Integrated YoutubeQuotaService for real-time quota tracking
 * 2. Added quota approval before starting sync jobs
 * 3. Track all API operations through quota service
 * 4. Implement priority-based sync execution
 * 5. Emergency mode awareness
 * 
 * This service now respects quota limits and provides better visibility.
 */

// Sync configuration (unchanged from original)
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
  priority?: SyncPriority; // NEW: Allow setting priority
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
  quotaApproved: boolean; // NEW
}

@Injectable()
export class YoutubeSyncService {
  private readonly logger = new Logger(YoutubeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtubeService: YoutubeService,
    private readonly quotaService: YoutubeQuotaService, // NEW: Inject quota service
  ) {}

  /**
   * Main sync method - intelligently selects full or incremental sync
   * NOW WITH QUOTA APPROVAL
   */
  async syncBand(bandId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    const band = await this.prisma.band.findUnique({ where: { id: bandId } });
    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    this.logger.log(`Starting sync for band: ${band.name} (${bandId})`);

    // Determine sync type and priority
    const isFirstSync = !band.firstSyncedAt;
    const isFullSync = options.forceFullSync || isFirstSync;
    const jobType = isFullSync ? SyncJobType.FULL_SYNC : SyncJobType.INCREMENTAL_SYNC;
    
    // Determine priority (NEW)
    const priority = options.priority || this.determinePriority(band, isFullSync);

    // Estimate quota cost (NEW)
    const estimatedCost = await this.estimateSyncCost(band, options);
    
    // Request quota approval (NEW)
    const approval = await this.quotaService.approveSyncJob(
      bandId,
      priority,
      estimatedCost,
    );

    if (!approval.approved) {
      this.logger.warn(
        `Sync job for ${band.name} not approved: ${approval.reason}`,
      );
      throw new Error(`Quota not available: ${approval.reason}`);
    }

    // Create sync job record (UPDATED with quota fields)
    const syncJob = await this.prisma.syncJob.create({
      data: {
        bandId,
        jobType,
        status: SyncJobStatus.IN_PROGRESS,
        startedAt: new Date(),
        publishedAfter: options.publishedAfter,
        publishedBefore: options.publishedBefore,
        maxVideos: options.maxVideos,
        priority, // NEW
        estimatedQuotaCost: estimatedCost, // NEW
        quotaApproved: true, // NEW
        quotaApprovalReason: approval.reason, // NEW
      },
    });

    // Update band sync status
    await this.prisma.band.update({
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
      quotaApproved: true, // NEW
    };

    try {
      // Execute sync with quota tracking
      await this.executeSyncWithQuotaTracking(band, syncJob.id, result, options);

      // Update sync job as completed
      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.COMPLETED,
          completedAt: new Date(),
          videosFound: result.videosProcessed,
          videosAdded: result.videosAdded,
          videosUpdated: result.videosUpdated,
          quotaUsed: result.quotaUsed,
          actualQuotaCost: result.quotaUsed, // NEW
          errors: result.errors,
        },
      });

      // Update band metadata
      await this.prisma.band.update({
        where: { id: bandId },
        data: {
          syncStatus: SyncStatus.COMPLETED,
          lastSyncAt: new Date(),
          firstSyncedAt: band.firstSyncedAt || new Date(),
          lastFullSync: isFullSync ? new Date() : band.lastFullSync,
        },
      });

      this.logger.log(
        `Sync completed for ${band.name}: ${result.videosAdded} added, ` +
        `${result.videosUpdated} updated, ${result.quotaUsed} quota used`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);

      // Update sync job as failed
      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          completedAt: new Date(),
          videosFound: result.videosProcessed,
          videosAdded: result.videosAdded,
          videosUpdated: result.videosUpdated,
          quotaUsed: result.quotaUsed,
          actualQuotaCost: result.quotaUsed, // NEW
          errors: result.errors,
          errorMessage,
        },
      });

      // Update band sync status
      await this.prisma.band.update({
        where: { id: bandId },
        data: { syncStatus: SyncStatus.FAILED },
      });

      this.logger.error(`Sync failed for ${band.name}: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Execute sync with quota tracking for every API call (NEW)
   */
  private async executeSyncWithQuotaTracking(
    band: any,
    syncJobId: string,
    result: SyncResult,
    options: SyncOptions,
  ): Promise<void> {
    // Determine sync method (channel vs search)
    if (band.youtubeChannelId) {
      await this.syncFromChannelWithTracking(band, syncJobId, result, options);
    } else {
      await this.syncFromSearchWithTracking(band, syncJobId, result, options);
    }
  }

  /**
   * Sync from channel with quota tracking (UPDATED)
   */
  private async syncFromChannelWithTracking(
    band: any,
    syncJobId: string,
    result: SyncResult,
    options: SyncOptions,
  ): Promise<void> {
    this.logger.log(`Syncing from channel: ${band.youtubeChannelId}`);

    try {
      // Track channel.list operation
      await this.quotaService.trackOperation(
        YouTubeOperation.CHANNEL_LIST,
        true,
        {
          bandId: band.id,
          bandName: band.name,
          syncJobId,
        },
      );
      result.quotaUsed += QUOTA_COSTS[YouTubeOperation.CHANNEL_LIST];

      // Fetch videos
      const fetchResult = await this.youtubeService.fetchAllChannelVideos(
        band.youtubeChannelId,
        options,
      );

      // Track quota usage from fetch
      result.quotaUsed += fetchResult.quotaUsed;
      result.errors.push(...fetchResult.errors);

      // Track each playlist operation
      const playlistPages = Math.ceil(fetchResult.videos.length / 50);
      for (let i = 0; i < playlistPages; i++) {
        await this.quotaService.trackOperation(
          YouTubeOperation.PLAYLIST_ITEMS_LIST,
          true,
          {
            bandId: band.id,
            bandName: band.name,
            syncJobId,
          },
        );
      }

      // Track video detail operations
      const videoDetailBatches = Math.ceil(fetchResult.videos.length / 50);
      for (let i = 0; i < videoDetailBatches; i++) {
        await this.quotaService.trackOperation(
          YouTubeOperation.VIDEO_LIST,
          true,
          {
            bandId: band.id,
            bandName: band.name,
            syncJobId,
          },
        );
      }

      // Upsert videos
      for (const video of fetchResult.videos) {
        result.videosProcessed++;
        try {
          await this.upsertVideo(band.id, video, result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to upsert video ${video.youtubeId}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Channel sync failed: ${errorMsg}`);
      
      // Track failed operation
      await this.quotaService.trackOperation(
        YouTubeOperation.CHANNEL_LIST,
        false,
        {
          bandId: band.id,
          bandName: band.name,
          syncJobId,
          errorMessage: errorMsg,
        },
      );
      
      throw error;
    }
  }

  /**
   * Sync from search with quota tracking (UPDATED)
   */
  private async syncFromSearchWithTracking(
    band: any,
    syncJobId: string,
    result: SyncResult,
    options: SyncOptions,
  ): Promise<void> {
    const searchQueries = this.generateSearchQueries(band.name, band.schoolName);
    
    this.logger.log(`Syncing from search with ${searchQueries.length} queries`);

    for (const query of searchQueries) {
      // Check quota before each search (searches are expensive!)
      const quotaCheck = await this.quotaService.checkQuotaAvailable(
        YouTubeOperation.SEARCH,
        1,
      );

      if (!quotaCheck.available) {
        this.logger.warn(`Quota not available for search: ${quotaCheck.reason}`);
        result.errors.push(`Quota limit reached: ${quotaCheck.reason}`);
        break;
      }

      try {
        // Perform search
        const videos = await this.youtubeService.searchVideosForBand(
          band.id,
          [query],
          options.maxVideos || SYNC_CONFIG.MAX_RESULTS_PER_SEARCH,
        );

        // Track search operation
        await this.quotaService.trackOperation(
          YouTubeOperation.SEARCH,
          true,
          {
            bandId: band.id,
            bandName: band.name,
            syncJobId,
            metadata: { query, resultsCount: videos.length },
          },
        );
        result.quotaUsed += QUOTA_COSTS[YouTubeOperation.SEARCH];

        // Track video details operation
        const videoDetailBatches = Math.ceil(videos.length / 50);
        for (let i = 0; i < videoDetailBatches; i++) {
          await this.quotaService.trackOperation(
            YouTubeOperation.VIDEO_LIST,
            true,
            {
              bandId: band.id,
              bandName: band.name,
              syncJobId,
            },
          );
        }
        result.quotaUsed += QUOTA_COSTS[YouTubeOperation.VIDEO_LIST] * videoDetailBatches;

        // Upsert videos
        for (const video of videos) {
          result.videosProcessed++;
          try {
            await this.upsertVideo(band.id, video, result);
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
        
        // Track failed operation
        await this.quotaService.trackOperation(
          YouTubeOperation.SEARCH,
          false,
          {
            bandId: band.id,
            bandName: band.name,
            syncJobId,
            errorMessage: errorMsg,
            metadata: { query },
          },
        );
      }
    }
  }

  /**
   * Determine sync priority based on band characteristics (NEW)
   */
  private determinePriority(band: any, isFullSync: boolean): SyncPriority {
    // Critical: Featured bands or official channels
    if (band.isFeatured || band.youtubeChannelId) {
      return SyncPriority.CRITICAL;
    }

    // High: Active bands or first sync
    if (isFullSync || band.isActive) {
      return SyncPriority.HIGH;
    }

    // Medium: Regular updates
    return SyncPriority.MEDIUM;
  }

  /**
   * Estimate quota cost for a sync job (NEW)
   */
  private async estimateSyncCost(
    band: any,
    options: SyncOptions,
  ): Promise<number> {
    const estimatedVideoCount = options.maxVideos || 50;
    
    return this.quotaService.estimateSyncCost({
      hasChannelId: !!band.youtubeChannelId,
      estimatedVideoCount,
      useSearch: !band.youtubeChannelId,
      searchQueriesCount: 3,
    });
  }

  /**
   * Upsert video to database (unchanged from original)
   */
  private async upsertVideo(
    bandId: string,
    video: any,
    result: SyncResult,
  ): Promise<void> {
    const existingVideo = await this.prisma.video.findUnique({
      where: { youtubeId: video.youtubeId },
    });

    if (existingVideo) {
      // Update existing video
      await this.prisma.video.update({
        where: { youtubeId: video.youtubeId },
        data: {
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
        },
      });
      result.videosUpdated++;
    } else {
      // Create new video
      await this.prisma.video.create({
        data: {
          youtubeId: video.youtubeId,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          publishedAt: video.publishedAt,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          bandId,
        },
      });
      result.videosAdded++;
    }
  }

  /**
   * Generate search queries (unchanged from original)
   */
  private generateSearchQueries(bandName: string, schoolName: string): string[] {
    return [
      `${bandName} marching band`,
      `${schoolName} band`,
      `${bandName} HBCU`,
    ];
  }

  /**
   * Delay helper (unchanged from original)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sync all bands incrementally (UPDATED with quota awareness)
   */
  async syncAllBandsIncremental(): Promise<SyncResult[]> {
    const bands = await this.prisma.band.findMany({
      where: { isActive: true },
      orderBy: { lastSyncAt: 'asc' },
    });

    this.logger.log(`Starting incremental sync for ${bands.length} bands`);

    const results: SyncResult[] = [];

    for (const band of bands) {
      // Check if quota available for at least one more sync
      const remaining = await this.quotaService.getRemainingQuota();
      if (remaining < 200) {
        this.logger.warn('Insufficient quota for remaining bands');
        break;
      }

      try {
        const result = await this.syncBand(band.id, {
          priority: SyncPriority.MEDIUM,
        });
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
   * Get sync statistics (UPDATED)
   */
  async getSyncStats() {
    const quotaStatus = await this.quotaService.getQuotaStatus();

    const [totalBands, syncedBands, totalVideos, recentJobs] = await Promise.all([
      this.prisma.band.count({ where: { isActive: true } }),
      this.prisma.band.count({ where: { isActive: true, firstSyncedAt: { not: null } } }),
      this.prisma.video.count(),
      this.prisma.syncJob.findMany({
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
      dailyQuotaUsed: quotaStatus.currentUsage, // NEW: From quota service
      dailyQuotaRemaining: quotaStatus.remaining, // NEW: From quota service
      quotaResetTime: quotaStatus.resetTime, // NEW: From quota service
      isEmergencyMode: quotaStatus.isEmergencyMode, // NEW
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        bandName: job.band?.name ?? 'Unknown',
        jobType: job.jobType,
        status: job.status,
        quotaUsed: job.actualQuotaCost || job.quotaUsed || 0, // NEW
        createdAt: job.createdAt,
      })),
    };
  }

  /**
   * Get bands needing full sync (unchanged from original)
   */
  async getBandsNeedingFullSync() {
    const bands = await this.prisma.band.findMany({
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
   * Full backfill (UPDATED with priority)
   */
  async fullBackfill(bandId: string): Promise<SyncResult> {
    return this.syncBand(bandId, {
      forceFullSync: true,
      publishedAfter: SYNC_CONFIG.YOUTUBE_LAUNCH_DATE,
      publishedBefore: new Date(),
      priority: SyncPriority.LOW, // NEW: Backfills are low priority
    });
  }
}