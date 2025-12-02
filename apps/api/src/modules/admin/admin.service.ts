import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SyncJobStatus, Prisma } from '@prisma/client';
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
  constructor(private readonly prisma: DatabaseService) {}

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
}