// FIXED: Line 85-91 and 359-369 for updatedAt and transaction issues

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SyncStatus } from '@prisma/client';
import { PrismaService} from '@bandhub/database';


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
  private readonly logger = new Logger(YouTubeVideoRepository.name);

  constructor(private readonly prisma: PrismaService) {}

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

    if (bandId) where.bandId = bandId;
    if (creatorId) where.creatorId = creatorId;
    if (channelId) where.channelId = channelId;
    if (syncStatus) where.syncStatus = syncStatus;
    if (isPromoted !== undefined) where.isPromoted = isPromoted;

    if (publishedAfter || publishedBefore) {
      where.publishedAt = {};
      if (publishedAfter) where.publishedAt.gte = publishedAfter;
      if (publishedBefore) where.publishedAt.lte = publishedBefore;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { channelTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.YouTubeVideoOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const skip = (page - 1) * limit;
    const takeValue = Math.max(1, Math.min(Number(limit) || 20, 100));

    const [videos, total] = await Promise.all([
      this.prisma.youTubeVideo.findMany({
        where,
        orderBy,
        skip,
        take: takeValue,
        select: {
          id: true,
          youtubeId: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          url: true,
          duration: true,
          publishedAt: true,
          viewCount: true,
          likeCount: true,
          channelId: true,
          channelTitle: true,
          syncStatus: true,
          lastSyncedAt: true,
          qualityScore: true,
          isPromoted: true,
          createdAt: true,
          updatedAt: true, // FIXED: Added updatedAt
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              schoolName: true,
              logoUrl: true,
            },
          },
          contentCreator: {
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
      this.prisma.youTubeVideo.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit: takeValue,
        totalPages: Math.ceil(total / takeValue),
      },
    };
  }

  async findById(id: string) {
    return this.prisma.youTubeVideo.findUnique({
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
        contentCreator: {
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

  async findByYoutubeId(youtubeId: string) {
    return this.prisma.youTubeVideo.findUnique({
      where: { youtubeId },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        bandId: true,
        creatorId: true,
        syncStatus: true,
        lastSyncedAt: true,
      },
    });
  }

  async create(data: YouTubeVideoCreateInput) {
    return this.prisma.youTubeVideo.create({
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
        lastSyncedAt: new Date(),
        ...(data.bandId && { band: { connect: { id: data.bandId } } }),
        ...(data.creatorId && { creator: { connect: { id: data.creatorId } } }),
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
      },
    });
  }

  async upsert(data: YouTubeVideoCreateInput): Promise<{ record: any; isNew: boolean }> {
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

    if (data.bandId) {
      updateData.band = { connect: { id: data.bandId } };
    }

    if (data.creatorId) {
      updateData.contentCreator = { connect: { id: data.creatorId } };
    }

    const record = await this.prisma.youTubeVideo.upsert({
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
      select: {
        id: true,
        youtubeId: true,
        title: true,
        bandId: true,
        creatorId: true,
      },
    });

    return { record, isNew: !existing };
  }

  // FIXED: Changed from transaction to sequential processing for batch upsert
  async batchUpsert(videos: YouTubeVideoCreateInput[]): Promise<{
    added: number;
    updated: number;
    errors: string[];
  }> {
    const results = {
      added: 0,
      updated: 0,
      errors: [] as string[],
    };

    // Process in chunks to avoid overwhelming the database
    const chunkSize = 50;
    for (let i = 0; i < videos.length; i += chunkSize) {
      const chunk = videos.slice(i, i + chunkSize);

      for (const video of chunk) {
        try {
          const result = await this.upsert(video);
          if (result.isNew) {
            results.added++;
          } else {
            results.updated++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Failed to upsert ${video.youtubeId}: ${errorMsg}`);
          this.logger.error(`Upsert failed for ${video.youtubeId}:`, error);
        }
      }
    }

    return results;
  }

  async update(id: string, data: Prisma.YouTubeVideoUpdateInput) {
    return this.prisma.youTubeVideo.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        youtubeId: true,
        syncStatus: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.youTubeVideo.delete({
      where: { id },
    });
  }

  async getStats() {
    const [total, byBand, byCreator, bySyncStatus] = await Promise.all([
      this.prisma.youTubeVideo.count(),
      this.prisma.youTubeVideo.groupBy({
        by: ['bandId'],
        _count: true,
        where: { bandId: { not: null } },
      }),
      this.prisma.youTubeVideo.groupBy({
        by: ['creatorId'],
        _count: true,
        where: { creatorId: { not: null } },
      }),
      this.prisma.youTubeVideo.groupBy({
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

    return this.prisma.youTubeVideo.findMany({
      where,
      select: {
        id: true,
        youtubeId: true,
        title: true,
        publishedAt: true,
        lastSyncedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getLatestVideoDate(channelId: string, bandId?: string, creatorId?: string) {
    const where: Prisma.YouTubeVideoWhereInput = { channelId };
    if (bandId) where.bandId = bandId;
    if (creatorId) where.creatorId = creatorId;

    const latestVideo = await this.prisma.youTubeVideo.findFirst({
      where,
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    return latestVideo?.publishedAt ?? null;
  }

  async countByChannel(channelId: string) {
    return this.prisma.youTubeVideo.count({
      where: { channelId },
    });
  }

  async getVideosBySyncStatus(syncStatus: SyncStatus, limit: number = 100): Promise<any[]> {
    return this.prisma.youTubeVideo.findMany({
      where: { syncStatus },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        channelId: true,
        syncErrors: true,
        createdAt: true,
        lastSyncedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async batchUpdateSyncStatus(
    youtubeIds: string[],
    syncStatus: SyncStatus,
    syncErrors?: string[],
  ) {
    return this.prisma.youTubeVideo.updateMany({
      where: {
        youtubeId: {
          in: youtubeIds,
        },
      },
      data: {
        syncStatus,
        lastSyncedAt: new Date(),
        ...(syncErrors && { syncErrors }),
      },
    });
  }
}