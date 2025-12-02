import { Injectable } from '@nestjs/common';
import { Prisma, SyncStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

export interface YouTubeVideoQueryDto {
  bandId?: string;
  creatorId?: string;
  channelId?: string;
  search?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  syncStatus?: SyncStatus;
  isPromoted?: boolean;
  sortBy?: 'publishedAt' | 'viewCount' | 'qualityScore' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface YouTubeVideoCreateInput {
  youtubeId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  url: string;
  duration?: number;
  publishedAt: Date;
  viewCount?: number;
  likeCount?: number;
  channelId: string;
  channelTitle?: string;
  bandId?: string;
  creatorId?: string;
  syncStatus?: SyncStatus;
  qualityScore?: number;
}

@Injectable()
export class YouTubeVideoRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find YouTube videos with filtering and pagination
   */
  async findMany(query: YouTubeVideoQueryDto) {
    const {
      bandId,
      creatorId,
      channelId,
      search,
      publishedAfter,
      publishedBefore,
      syncStatus,
      isPromoted,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.YouTubeVideoWhereInput = {};

    // Filter by band
    if (bandId) {
      where.bandId = bandId;
    }

    // Filter by creator
    if (creatorId) {
      where.creatorId = creatorId;
    }

    // Filter by channel
    if (channelId) {
      where.channelId = channelId;
    }

    // Filter by sync status
    if (syncStatus) {
      where.syncStatus = syncStatus;
    }

    // Filter by promoted status
    if (isPromoted !== undefined) {
      where.isPromoted = isPromoted;
    }

    // Date range filtering
    if (publishedAfter || publishedBefore) {
      where.publishedAt = {};
      if (publishedAfter) {
        where.publishedAt.gte = publishedAfter;
      }
      if (publishedBefore) {
        where.publishedAt.lte = publishedBefore;
      }
    }

    // Full-text search on title and description
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
        {
          channelTitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Sorting
    const orderBy: Prisma.YouTubeVideoOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [videos, total] = await Promise.all([
      this.db.youTubeVideo.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              schoolName: true,
              logoUrl: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              thumbnailUrl: true,
              isVerified: true,
            },
          },
        },
      }),
      this.db.youTubeVideo.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a YouTube video by ID
   */
  async findById(id: string) {
    return this.db.youTubeVideo.findUnique({
      where: { id },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            thumbnailUrl: true,
            isVerified: true,
          },
        },
      },
    });
  }

  /**
   * Find a YouTube video by its YouTube ID
   */
  async findByYoutubeId(youtubeId: string) {
    return this.db.youTubeVideo.findUnique({
      where: { youtubeId },
    });
  }

  /**
   * Create a new YouTube video record
   */
  async create(data: YouTubeVideoCreateInput) {
    return this.db.youTubeVideo.create({
      data: {
        youtubeId: data.youtubeId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        url: data.url,
        duration: data.duration ?? 0,
        publishedAt: data.publishedAt,
        viewCount: data.viewCount ?? 0,
        likeCount: data.likeCount ?? 0,
        channelId: data.channelId,
        channelTitle: data.channelTitle,
        syncStatus: data.syncStatus ?? SyncStatus.COMPLETED,
        qualityScore: data.qualityScore ?? 0,
        ...(data.bandId && { band: { connect: { id: data.bandId } } }),
        ...(data.creatorId && { creator: { connect: { id: data.creatorId } } }),
      },
    });
  }

  /**
   * Upsert a YouTube video (create or update)
   * Returns the record with isNew flag indicating if it was created
   */
  async upsert(data: YouTubeVideoCreateInput): Promise<{ record: any; isNew: boolean }> {
    // First check if the record exists
    const existing = await this.findByYoutubeId(data.youtubeId);
    
    const updateData: Prisma.YouTubeVideoUpdateInput = {
      title: data.title,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      viewCount: data.viewCount ?? 0,
      likeCount: data.likeCount ?? 0,
      lastSyncedAt: new Date(),
      syncStatus: SyncStatus.COMPLETED,
    };

    // Handle band relationship
    if (data.bandId) {
      updateData.band = { connect: { id: data.bandId } };
    }

    // Handle creator relationship
    if (data.creatorId) {
      updateData.creator = { connect: { id: data.creatorId } };
    }

    const record = await this.db.youTubeVideo.upsert({
      where: { youtubeId: data.youtubeId },
      create: {
        youtubeId: data.youtubeId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        url: data.url,
        duration: data.duration ?? 0,
        publishedAt: data.publishedAt,
        viewCount: data.viewCount ?? 0,
        likeCount: data.likeCount ?? 0,
        channelId: data.channelId,
        channelTitle: data.channelTitle,
        syncStatus: SyncStatus.COMPLETED,
        lastSyncedAt: new Date(),
        qualityScore: data.qualityScore ?? 0,
        ...(data.bandId && { band: { connect: { id: data.bandId } } }),
        ...(data.creatorId && { creator: { connect: { id: data.creatorId } } }),
      },
      update: updateData,
    });

    return { record, isNew: !existing };
  }

  /**
   * Update a YouTube video
   */
  async update(id: string, data: Prisma.YouTubeVideoUpdateInput) {
    return this.db.youTubeVideo.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a YouTube video
   */
  async delete(id: string) {
    return this.db.youTubeVideo.delete({
      where: { id },
    });
  }

  /**
   * Bulk create YouTube videos
   */
  async createMany(videos: YouTubeVideoCreateInput[]) {
    const results = {
      added: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const video of videos) {
      try {
        const existing = await this.findByYoutubeId(video.youtubeId);
        if (existing) {
          await this.update(existing.id, {
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            lastSyncedAt: new Date(),
            syncStatus: SyncStatus.COMPLETED,
          });
          results.updated++;
        } else {
          await this.create(video);
          results.added++;
        }
      } catch (error) {
        results.errors.push(`Failed to process video ${video.youtubeId}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Get video statistics
   */
  async getStats() {
    const [total, byBand, byCreator, bySyncStatus] = await Promise.all([
      this.db.youTubeVideo.count(),
      this.db.youTubeVideo.groupBy({
        by: ['bandId'],
        _count: true,
        where: { bandId: { not: null } },
      }),
      this.db.youTubeVideo.groupBy({
        by: ['creatorId'],
        _count: true,
        where: { creatorId: { not: null } },
      }),
      this.db.youTubeVideo.groupBy({
        by: ['syncStatus'],
        _count: true,
      }),
    ]);

    return {
      total,
      byBandCount: byBand.length,
      byCreatorCount: byCreator.length,
      bySyncStatus: bySyncStatus.map((s) => ({
        status: s.syncStatus,
        count: s._count,
      })),
    };
  }

  /**
   * Get videos that need syncing (for incremental sync)
   */
  async getVideosNeedingSync(channelId: string, lastSyncAt?: Date) {
    const where: Prisma.YouTubeVideoWhereInput = {
      channelId,
    };

    if (lastSyncAt) {
      where.OR = [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: lastSyncAt } },
      ];
    }

    return this.db.youTubeVideo.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Find the latest video published date for a channel
   */
  async getLatestVideoDate(channelId: string, bandId?: string, creatorId?: string) {
    const where: Prisma.YouTubeVideoWhereInput = { channelId };
    if (bandId) where.bandId = bandId;
    if (creatorId) where.creatorId = creatorId;

    const latestVideo = await this.db.youTubeVideo.findFirst({
      where,
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    return latestVideo?.publishedAt ?? null;
  }

  /**
   * Count videos by channel
   */
  async countByChannel(channelId: string) {
    return this.db.youTubeVideo.count({
      where: { channelId },
    });
  }
}
