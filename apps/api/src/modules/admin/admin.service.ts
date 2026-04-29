import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@bandhub/database';
import { CacheService } from '@bandhub/cache';
import { SyncJobStatus, Prisma } from '@prisma/client';
import { QUEUE_NAMES, JobType, JobPriority, CategorizeVideosJobData, RematchVideosJobData, PromoteVideosJobData } from '@hbcu-band-hub/shared-types';
import {
  DashboardStatsDto,
  RecentActivityDto,
  RecentVideoDto,
  SyncJobDto,
  SyncStatusDto,
  VideoTrendDto,
  CategoryDistributionDto,
  TopBandDto,
} from './dto/dashboard.dto';
import { AdminVideoQueryDto } from './dto/admin-video-query.dto';
import { BulkVideoUpdateDto, BulkVideoUpdateResponseDto, BulkVideoAction } from './dto/bulk-video-update.dto';
import { VideoDetailDto } from './dto/video-detail.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @InjectQueue(QUEUE_NAMES.MAINTENANCE)
    private readonly maintenanceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.VIDEO_PROCESSING)
    private readonly videoProcessingQueue: Queue,
  ) {}

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    // Get total counts
    const [totalVideos, totalBands, pendingModeration] = await Promise.all([
      this.prisma.video.count(),
      this.prisma.band.count(),
      this.prisma.video.count({ where: { isHidden: true } }),
    ]);

    // Get videos added in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const videosThisWeek = await this.prisma.video.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get last sync job status
    const lastSyncJob = await this.prisma.syncJob.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return {
      totalVideos,
      totalBands,
      videosThisWeek,
      pendingModeration,
      lastSyncStatus: lastSyncJob?.status,
      lastSyncTime: lastSyncJob?.completedAt || lastSyncJob?.createdAt,
    };
  }

  /**
   * Get recent activity (videos and sync jobs)
   */
  async getRecentActivity(): Promise<RecentActivityDto> {
    // Get last 10 videos
    const videos = await this.prisma.video.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        createdAt: true,
        isHidden: true,
        band: {
          select: {
            name: true,
          },
        },
      },
    });

    const recentVideos: RecentVideoDto[] = videos.map((video) => ({
      id: video.id,
      title: video.title,
      bandName: video.band.name,
      thumbnailUrl: video.thumbnailUrl,
      createdAt: video.createdAt,
      isHidden: video.isHidden,
    }));

    // Get last 5 sync jobs
    const syncJobs = await this.prisma.syncJob.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Fetch band names for band-specific sync jobs
    const bandIds = syncJobs
      .filter((job) => job.bandId)
      .map((job) => job.bandId as string);
    
    const bands = await this.prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: { id: true, name: true },
    });

    const bandMap = new Map(bands.map((band) => [band.id, band.name]));

    const recentSyncJobs: SyncJobDto[] = syncJobs.map((job) => ({
      id: job.id,
      status: job.status,
      videosFound: job.videosFound,
      videosAdded: job.videosAdded,
      videosUpdated: job.videosUpdated,
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined,
      bandName: job.bandId ? bandMap.get(job.bandId) : undefined,
    }));

    return {
      recentVideos,
      recentSyncJobs,
    };
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatusDto> {
    // Find running sync job
    const runningJob = await this.prisma.syncJob.findFirst({
      where: {
        status: SyncJobStatus.IN_PROGRESS,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Get band name if band-specific sync
    let bandName: string | undefined;
    if (runningJob?.bandId) {
      const band = await this.prisma.band.findUnique({
        where: { id: runningJob.bandId },
        select: { name: true },
      });
      bandName = band?.name;
    }

    // Get failed jobs from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const failedJobs = await this.prisma.syncJob.findMany({
      where: {
        status: SyncJobStatus.FAILED,
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Fetch band names for failed jobs
    const bandIds = failedJobs
      .filter((job) => job.bandId)
      .map((job) => job.bandId as string);
    
    const bands = await this.prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: { id: true, name: true },
    });

    const bandMap = new Map(bands.map((band) => [band.id, band.name]));

    const failedJobsDto: SyncJobDto[] = failedJobs.map((job) => ({
      id: job.id,
      status: job.status,
      videosFound: job.videosFound,
      videosAdded: job.videosAdded,
      videosUpdated: job.videosUpdated,
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined,
      bandName: job.bandId ? bandMap.get(job.bandId) : undefined,
    }));

    return {
      isRunning: !!runningJob,
      currentJob: runningJob
        ? {
            id: runningJob.id,
            status: runningJob.status,
            videosFound: runningJob.videosFound,
            videosAdded: runningJob.videosAdded,
            videosUpdated: runningJob.videosUpdated,
            createdAt: runningJob.createdAt,
            completedAt: runningJob.completedAt || undefined,
            bandName,
          }
        : undefined,
      failedJobs: failedJobsDto,
    };
  }

  /**
   * Get video trends over the last 30 days
   */
  async getVideoTrends(): Promise<VideoTrendDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const videos = await this.prisma.video.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Group videos by date
    const videosByDate = new Map<string, number>();
    
    // Initialize all dates with 0
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime());
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      videosByDate.set(dateStr, 0);
    }

    // Count videos per date
    videos.forEach((video) => {
      const dateStr = video.createdAt.toISOString().split('T')[0];
      const count = videosByDate.get(dateStr) || 0;
      videosByDate.set(dateStr, count + 1);
    });

    // Convert to array and sort by date
    const trends: VideoTrendDto[] = Array.from(videosByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution(): Promise<CategoryDistributionDto[]> {
    const categories = await this.prisma.category.findMany({
      select: {
        name: true,
        slug: true,
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    return categories
      .map((category) => ({
        name: category.name,
        slug: category.slug,
        count: category._count.videos,
      }))
      .filter((category) => category.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get top 10 bands by video count
   */
  async getTopBands(): Promise<TopBandDto[]> {
    const bands = await this.prisma.band.findMany({
      select: {
        id: true,
        name: true,
        schoolName: true,
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    return bands
      .map((band) => ({
        id: band.id,
        name: band.name,
        schoolName: band.schoolName,
        videoCount: band._count.videos,
      }))
      .sort((a, b) => b.videoCount - a.videoCount)
      .slice(0, 10);
  }

  /**
   * Get videos for admin moderation with advanced filtering
   */
  async getAdminVideos(query: AdminVideoQueryDto): Promise<{
    data: VideoDetailDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      bandId,
      categoryId,
      opponentBandId,
      eventYear,
      eventName,
      search,
      hiddenStatus = 'all',
      categorizationStatus = 'all',
      tags,
      dateFrom,
      dateTo,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    // Build the where clause
    const where: Prisma.VideoWhereInput = {};

    // Hidden status filter
    if (hiddenStatus === 'visible') {
      where.isHidden = false;
    } else if (hiddenStatus === 'hidden') {
      where.isHidden = true;
    }
    // 'all' means no filter on isHidden

    // Categorization status filter
    if (categorizationStatus === 'categorized') {
      where.categoryId = { not: null };
    } else if (categorizationStatus === 'uncategorized') {
      where.categoryId = null;
    }

    // Band filtering
    if (bandId) {
      where.bandId = bandId;
    }

    // Category filtering
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Opponent band filtering
    if (opponentBandId) {
      where.opponentBandId = opponentBandId;
    }

    // Event filtering
    if (eventYear) {
      where.eventYear = eventYear;
    }
    if (eventName) {
      where.eventName = {
        contains: eventName,
        mode: 'insensitive',
      };
    }

    // Tags filtering
    if (tags) {
      const tagList = tags.split(',').map((tag) => tag.trim());
      where.tags = {
        hasSome: tagList,
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.publishedAt = {};
      if (dateFrom) {
        where.publishedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.publishedAt.lte = new Date(dateTo);
      }
    }

    // Full-text search
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build order by
    const orderBy: Prisma.VideoOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Execute query
    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          opponentBand: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    // Map to DTO
    const data: VideoDetailDto[] = videos.map((video) => ({
      id: video.id,
      youtubeId: video.youtubeId,
      title: video.title,
      description: video.description || undefined,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      eventName: video.eventName || undefined,
      eventYear: video.eventYear || undefined,
      tags: video.tags,
      isHidden: video.isHidden,
      hideReason: video.hideReason || undefined,
      qualityScore: video.qualityScore,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      band: video.band,
      category: video.category || undefined,
      opponentBand: video.opponentBand || undefined,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Bulk update videos
   */
  async bulkUpdateVideos(
    dto: BulkVideoUpdateDto,
    adminUserId: string,
  ): Promise<BulkVideoUpdateResponseDto> {
    const { videoIds, action } = dto;

    if (!videoIds || videoIds.length === 0) {
      throw new BadRequestException('No video IDs provided');
    }

    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    const errors: { [videoId: string]: string } = {};

    // Process each video
    for (const videoId of videoIds) {
      try {
        // Verify video exists
        const video = await this.prisma.video.findUnique({
          where: { id: videoId },
        });

        if (!video) {
          failedIds.push(videoId);
          errors[videoId] = 'Video not found';
          continue;
        }

        // Perform action based on type
        switch (action) {
          case BulkVideoAction.CATEGORIZE:
            if (!dto.categoryId) {
              throw new BadRequestException('Category ID required for categorize action');
            }
            // Verify category exists
            const category = await this.prisma.category.findUnique({
              where: { id: dto.categoryId },
            });
            if (!category) {
              throw new BadRequestException('Category not found');
            }
            await this.prisma.video.update({
              where: { id: videoId },
              data: { categoryId: dto.categoryId },
            });
            break;

          case BulkVideoAction.HIDE:
            await this.prisma.video.update({
              where: { id: videoId },
              data: {
                isHidden: true,
                hideReason: dto.hideReason || 'Hidden by admin',
              },
            });
            break;

          case BulkVideoAction.UNHIDE:
            await this.prisma.video.update({
              where: { id: videoId },
              data: {
                isHidden: false,
                hideReason: null,
              },
            });
            break;

          case BulkVideoAction.DELETE:
            await this.prisma.video.delete({
              where: { id: videoId },
            });
            break;

          case BulkVideoAction.UPDATE_METADATA:
            const updateData: Prisma.VideoUpdateInput = {};
            if (dto.opponentBandId !== undefined) {
              if (dto.opponentBandId) {
                updateData.opponentBand = { connect: { id: dto.opponentBandId } };
              } else {
                updateData.opponentBand = { disconnect: true };
              }
            }
            if (dto.eventName !== undefined) {
              updateData.eventName = dto.eventName;
            }
            if (dto.eventYear !== undefined) {
              updateData.eventYear = dto.eventYear;
            }
            if (dto.tags !== undefined) {
              updateData.tags = dto.tags.split(',').map((tag) => tag.trim());
            }
            if (dto.qualityScore !== undefined) {
              updateData.qualityScore = dto.qualityScore;
            }
            await this.prisma.video.update({
              where: { id: videoId },
              data: updateData,
            });
            break;

          default:
            throw new BadRequestException(`Unknown action: ${action}`);
        }

        successfulIds.push(videoId);

        // Log audit trail
        await this.logAuditAction(adminUserId, 'bulk_video_update', {
          videoId,
          action,
          dto,
        });
      } catch (error) {
        failedIds.push(videoId);
        errors[videoId] = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (successfulIds.length > 0) {
      await this.cacheService.delPattern('videos:*');
    }

    return {
      successCount: successfulIds.length,
      failedCount: failedIds.length,
      successfulIds,
      failedIds,
      errors: failedIds.length > 0 ? errors : undefined,
    };
  }

  /**
   * Update a single video
   */
  async updateVideo(
    videoId: string,
    updateData: {
      categoryId?: string;
      opponentBandId?: string;
      eventName?: string;
      eventYear?: number;
      tags?: string[];
      qualityScore?: number;
      isHidden?: boolean;
      hideReason?: string;
    },
    adminUserId: string,
  ): Promise<VideoDetailDto> {
    // Verify video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${videoId} not found`);
    }

    // Build update data
    const prismaUpdateData: Prisma.VideoUpdateInput = {};

    if (updateData.categoryId !== undefined) {
      if (updateData.categoryId) {
        // Verify category exists
        const category = await this.prisma.category.findUnique({
          where: { id: updateData.categoryId },
        });
        if (!category) {
          throw new BadRequestException('Category not found');
        }
        prismaUpdateData.category = { connect: { id: updateData.categoryId } };
      } else {
        prismaUpdateData.category = { disconnect: true };
      }
    }

    if (updateData.opponentBandId !== undefined) {
      if (updateData.opponentBandId) {
        // Verify band exists
        const band = await this.prisma.band.findUnique({
          where: { id: updateData.opponentBandId },
        });
        if (!band) {
          throw new BadRequestException('Opponent band not found');
        }
        prismaUpdateData.opponentBand = { connect: { id: updateData.opponentBandId } };
      } else {
        prismaUpdateData.opponentBand = { disconnect: true };
      }
    }

    if (updateData.eventName !== undefined) {
      prismaUpdateData.eventName = updateData.eventName;
    }

    if (updateData.eventYear !== undefined) {
      prismaUpdateData.eventYear = updateData.eventYear;
    }

    if (updateData.tags !== undefined) {
      prismaUpdateData.tags = updateData.tags;
    }

    if (updateData.qualityScore !== undefined) {
      prismaUpdateData.qualityScore = updateData.qualityScore;
    }

    if (updateData.isHidden !== undefined) {
      prismaUpdateData.isHidden = updateData.isHidden;
      if (!updateData.isHidden) {
        prismaUpdateData.hideReason = null;
      }
    }

    if (updateData.hideReason !== undefined) {
      prismaUpdateData.hideReason = updateData.hideReason;
    }

    // Update video
    const updatedVideo = await this.prisma.video.update({
      where: { id: videoId },
      data: prismaUpdateData,
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        opponentBand: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    // Log audit trail
    await this.logAuditAction(adminUserId, 'video_update', {
      videoId,
      updateData,
    });

    return {
      id: updatedVideo.id,
      youtubeId: updatedVideo.youtubeId,
      title: updatedVideo.title,
      description: updatedVideo.description || undefined,
      thumbnailUrl: updatedVideo.thumbnailUrl,
      duration: updatedVideo.duration,
      publishedAt: updatedVideo.publishedAt,
      viewCount: updatedVideo.viewCount,
      likeCount: updatedVideo.likeCount,
      eventName: updatedVideo.eventName || undefined,
      eventYear: updatedVideo.eventYear || undefined,
      tags: updatedVideo.tags,
      isHidden: updatedVideo.isHidden,
      hideReason: updatedVideo.hideReason || undefined,
      qualityScore: updatedVideo.qualityScore,
      createdAt: updatedVideo.createdAt,
      updatedAt: updatedVideo.updatedAt,
      band: updatedVideo.band,
      category: updatedVideo.category || undefined,
      opponentBand: updatedVideo.opponentBand || undefined,
    };
  }

  /**
   * Log audit action for moderation
   */
  private async logAuditAction(
    adminUserId: string,
    action: string,
    metadata: any,
  ): Promise<void> {
    // For now, just log to console
    // In production, you would store this in a dedicated audit log table
    console.log('[AUDIT]', {
      timestamp: new Date().toISOString(),
      adminUserId,
      action,
      metadata,
    });
  }

  /**
   * Enqueue a job to auto-categorize videos using pattern matching.
   * No YouTube API quota is consumed — runs entirely against the database.
   *
   * @param uncategorizedOnly - true (default): only process videos with no category;
   *                            false: re-run categorization on all videos
   */
  async triggerCategorization(uncategorizedOnly = true): Promise<{ jobId: string; message: string }> {
    const data: CategorizeVideosJobData = {
      type: JobType.CATEGORIZE_VIDEOS,
      triggeredBy: 'admin',
      uncategorizedOnly,
      priority: JobPriority.LOW,
    };

    const job = await this.maintenanceQueue.add(JobType.CATEGORIZE_VIDEOS, data, {
      priority: JobPriority.LOW,
      jobId: `categorize-videos-${Date.now()}`,
    });

    return {
      jobId: job.id!,
      message: uncategorizedOnly
        ? 'Categorization job queued — will process all videos currently missing a category.'
        : 'Categorization job queued — will re-run pattern matching on all videos.',
    };
  }

  /**
   * Enqueue a job to re-match YouTube videos using the enhanced matching pipeline.
   *
   * @param filter - Which videos to re-process:
   *   - 'unmatched': videos with no band assigned
   *   - 'low_confidence': matches below qualityScoreThreshold (default 50)
   *   - 'alias_only': videos matched via alias fallback only (weakest signal)
   *   - 'all': all videos except MANUAL matches
   * @param qualityScoreThreshold - Re-match low_confidence videos below this score (default 50)
   * @param limit - Maximum number of videos to reset in this run
   */
  async triggerRematch(
    filter: RematchVideosJobData['filter'] = 'unmatched',
    qualityScoreThreshold = 50,
    limit?: number,
  ): Promise<{ jobId: string; message: string }> {
    const data: RematchVideosJobData = {
      type: JobType.REMATCH_VIDEOS,
      triggeredBy: 'admin',
      filter,
      qualityScoreThreshold,
      limit,
      priority: JobPriority.NORMAL,
    };

    const job = await this.videoProcessingQueue.add(JobType.REMATCH_VIDEOS, data, {
      priority: JobPriority.NORMAL,
      jobId: `rematch-videos-${filter}-${Date.now()}`,
    });

    return {
      jobId: job.id!,
      message: `Re-match job queued (filter: ${filter}). Videos will be reset and re-processed through the enhanced matching pipeline.`,
    };
  }

  /**
   * DEV ONLY — nuclear reset: clears Video + VideoBand tables, resets isPromoted
   * on all YouTubeVideos, then triggers a full re-match.
   * Never call this in production.
   */
  async devResetAndRematch(): Promise<{
    deletedVideos: number;
    deletedVideoBands: number;
    resetYouTubeVideos: number;
    matchJobId: string;
    message: string;
  }> {
    // Delete VideoBand first (FK dependency on Video)
    const deletedVideoBandsResult = await (this.prisma as any).videoBand.deleteMany({});
    const deletedVideosResult = await this.prisma.video.deleteMany({});

    // Reset isPromoted so the promote step re-processes everything
    const resetResult = await (this.prisma.youTubeVideo.updateMany as any)({
      data: { isPromoted: false, promotedAt: null },
    });

    const data: RematchVideosJobData = {
      type: JobType.REMATCH_VIDEOS,
      triggeredBy: 'admin',
      filter: 'all',
      priority: JobPriority.NORMAL,
    };

    const job = await this.videoProcessingQueue.add(JobType.REMATCH_VIDEOS, data, {
      priority: JobPriority.NORMAL,
      jobId: `dev-full-reset-rematch-${Date.now()}`,
    });

    return {
      deletedVideos: deletedVideosResult.count,
      deletedVideoBands: deletedVideoBandsResult.count,
      resetYouTubeVideos: resetResult.count,
      matchJobId: job.id!,
      message: 'Dev reset complete. Video and VideoBand tables cleared. Full re-match job enqueued.',
    };
  }

  async triggerPromote(limit?: number): Promise<{ jobId: string; message: string }> {
    const data: PromoteVideosJobData = {
      type: JobType.PROMOTE_VIDEOS,
      triggeredBy: 'admin',
      limit,
      priority: JobPriority.NORMAL,
    };

    const job = await this.videoProcessingQueue.add(JobType.PROMOTE_VIDEOS, data, {
      priority: JobPriority.NORMAL,
      jobId: `promote-videos-admin-${Date.now()}`,
    });

    return {
      jobId: job.id!,
      message: 'Promote job queued. Matched YouTubeVideos will be upserted into the Video table.',
    };
  }

  /**
   * Paginated report of YouTubeVideos that could not be matched to a band,
   * grouped by noMatchReason with summary counts.
   */
  async getUnmatchedVideoReport(
    page = 1,
    limit = 50,
  ): Promise<{
    summary: Array<{ reason: string | null; count: number }>;
    data: Array<{
      id: string;
      youtubeId: string;
      title: string;
      channelId: string;
      channelTitle: string | null;
      aiExcluded: boolean;
      noMatchReason: string | null;
      matchAttemptedAt: Date | null;
      publishedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where = {
      OR: [
        { bandId: null },
        { aiExcluded: true },
      ],
    };

    const [total, data, reasonGroups] = await Promise.all([
      this.prisma.youTubeVideo.count({ where }),
      (this.prisma.youTubeVideo.findMany as any)({
        where,
        select: {
          id: true,
          youtubeId: true,
          title: true,
          channelId: true,
          channelTitle: true,
          aiExcluded: true,
          noMatchReason: true,
          matchAttemptedAt: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma.youTubeVideo.groupBy as any)({
        by: ['noMatchReason'],
        where,
        _count: { _all: true },
        orderBy: { _count: { noMatchReason: 'desc' } },
      }),
    ]);

    const summary = (reasonGroups as any[]).map((g) => ({
      reason: g.noMatchReason as string | null,
      count: g._count._all as number,
    }));

    return {
      summary,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Hide all promoted Video records whose source YouTubeVideo was AI-excluded
   * (i.e. flagged as non-HBCU content such as high school bands).
   * Sets isHidden=true — reversible via the admin videos page.
   */
  async hideExcludedVideos(): Promise<{ hidden: number; message: string }> {
    // Find youtube_videos marked as excluded
    const excludedYtVideos = await this.prisma.youTubeVideo.findMany({
      where: { aiExcluded: true },
      select: { youtubeId: true },
    });

    if (excludedYtVideos.length === 0) {
      return { hidden: 0, message: 'No AI-excluded YouTube videos found.' };
    }

    const youtubeIds = excludedYtVideos.map((v) => v.youtubeId);

    // Hide matching promoted Video records
    const result = await this.prisma.video.updateMany({
      where: {
        youtubeId: { in: youtubeIds },
        isHidden: false,
      },
      data: { isHidden: true },
    });

    await this.cacheService.delPattern('videos:*');
    return {
      hidden: result.count,
      message: `Hidden ${result.count} promoted videos flagged as non-HBCU content (high school, drum corps, etc.).`,
    };
  }

  async hideGreekLifeVideos(): Promise<{ hidden: number; message: string }> {
    const GREEK_LIFE_KEYWORDS = [
      'probate', 'neophyte', 'crossing ceremony', 'line show',
      'step show', 'step off', 'step competition', 'step contest', 'step battle',
      'stroll off', 'strolling competition', 'strolling show', 'greek stroll',
      'greek life', 'greek week', 'greek show',
      'nphc', 'divine nine',
      'fraternity show', 'sorority show', 'frat show',
      'alpha phi alpha', 'omega psi phi', 'kappa alpha psi',
      'phi beta sigma', 'iota phi theta',
      'alpha kappa alpha', 'delta sigma theta',
      'sigma gamma rho', 'zeta phi beta', 'kappa kappa psi', 'tau beta sigma',
    ];

    const result = await this.prisma.video.updateMany({
      where: {
        isHidden: false,
        OR: GREEK_LIFE_KEYWORDS.map((kw) => ({
          title: { contains: kw, mode: 'insensitive' as const },
        })),
      },
      data: { isHidden: true, hideReason: 'greek-life' },
    });

    await this.cacheService.delPattern('videos:*');
    return {
      hidden: result.count,
      message: `Hidden ${result.count} Greek life videos (probates, step shows, stroll offs, etc.).`,
    };
  }

  /**
   * Re-run category detection on promoted Video records currently assigned to
   * the "other" catch-all category or with no category at all.
   * Uses the same keyword matching logic as the promote processor.
   */
  async recategorizeOtherVideos(): Promise<{ updated: number; message: string }> {
    // Find the "other" category id
    const otherCategory = await this.prisma.category.findUnique({
      where: { slug: 'other' },
      select: { id: true },
    });

    const videos = await this.prisma.video.findMany({
      where: {
        OR: [
          { categoryId: otherCategory?.id ?? '__none__' },
          { categoryId: null },
        ],
        isHidden: false,
      },
      select: { id: true, title: true, description: true, categoryId: true },
    });

    if (videos.length === 0) {
      return { updated: 0, message: 'No videos in "Other" category to recategorize.' };
    }

    // Fetch all categories once
    const categories = await this.prisma.category.findMany({ select: { id: true, slug: true } });
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

    let updated = 0;
    for (const video of videos) {
      const newSlug = this.detectCategorySlug(video.title, video.description ?? '');
      if (!newSlug || newSlug === 'other') continue;
      const newCategoryId = categoryBySlug.get(newSlug);
      if (!newCategoryId) continue;
      await this.prisma.video.update({
        where: { id: video.id },
        data: { categoryId: newCategoryId },
      });
      updated++;
    }

    return {
      updated,
      message: `Recategorized ${updated} of ${videos.length} "Other" videos to more specific categories.`,
    };
  }

  private detectCategorySlug(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    if (text.match(/\b(5th\s*quarter|fifth\s*quarter|post\s*game|after\s*the\s*game)\b/i)) return '5th-quarter';
    if (text.match(/\b(stand\s*battle|battle\s*of\s*(the\s*)?bands|band\s*battle|stands?\s*vs\.?)\b/i)) return 'stand-battle';
    if (text.match(/\b(field\s*show|marching\s*show|formation|drill\s*team)\b/i)) return 'field-show';
    if (text.match(/\b(halftime|half\s*time|half-time)\b/i)) return 'halftime';
    if (text.match(/\b(pregame|pre\s*game|before\s*the\s*game)\b/i)) return 'pregame';
    if (text.match(/\b(entrance|entering|arrival)\b/i)) return 'entrance';
    if (text.match(/\b(parade|homecoming\s*parade|mardi\s*gras)\b/i)) return 'parade';
    if (text.match(/\b(practice|rehearsal|sectional|band\s*camp|band\s*room)\b/i)) return 'practice';
    if (text.match(/\b(concert|symphonic|spring\s*show|indoor)\b/i)) return 'concert-band';
    return 'other';
  }
}