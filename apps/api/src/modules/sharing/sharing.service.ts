import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { CreateShareDto, GetSharesQueryDto, ContentType, SharePlatform } from './dto/sharing.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SharingService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async trackShare(userId: string | null, dto: CreateShareDto) {
    // Verify content exists
    await this.verifyContentExists(dto.contentType, dto.contentId);

    // Create share record using ContentShare model
    const share = await this.prisma.contentShare.create({
      data: {
        userId: userId || undefined,
        videoId: dto.contentType === ContentType.VIDEO ? dto.contentId : undefined,
        bandId: dto.contentType === ContentType.BAND ? dto.contentId : undefined,
        playlistId: dto.contentType === ContentType.PLAYLIST ? dto.contentId : undefined,
        platform: dto.platform,
      },
    });

    // Increment share counts
    await this.incrementShareCount(dto.contentType, dto.contentId, dto.platform);

    return {
      id: share.id,
      contentType: dto.contentType,
      contentId: dto.contentId,
      platform: dto.platform,
      sharedAt: share.sharedAt,
    };
  }

  async getSharesByContent(
    contentType: ContentType,
    contentId: string,
    query: GetSharesQueryDto,
  ) {
    await this.verifyContentExists(contentType, contentId);

    const where = this.buildShareWhereClause(contentType, contentId);

    const [shares, total] = await Promise.all([
      this.prisma.contentShare.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { sharedAt: 'desc' },
        select: {
          id: true,
          platform: true,
          sharedAt: true,
        },
      }),
      this.prisma.contentShare.count({ where }),
    ]);

    return {
      shares,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    };
  }

  async getShareLink(contentType: ContentType, contentId: string): Promise<string> {
    await this.verifyContentExists(contentType, contentId);

    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');

    switch (contentType) {
      case ContentType.VIDEO:
        return `${baseUrl}/videos/${contentId}`;
      case ContentType.BAND:
        return `${baseUrl}/bands/${contentId}`;
      case ContentType.PLAYLIST:
        return `${baseUrl}/playlists/${contentId}`;
      default:
        throw new Error('Invalid content type');
    }
  }

  async getShareStats(contentType: ContentType, contentId: string) {
    await this.verifyContentExists(contentType, contentId);

    const where = this.buildShareWhereClause(contentType, contentId);

    const [totalShares, platformBreakdown] = await Promise.all([
      this.prisma.contentShare.count({ where }),
      this.prisma.contentShare.groupBy({
        by: ['platform'],
        where,
        _count: {
          platform: true,
        },
      }),
    ]);

    const byPlatform = platformBreakdown.reduce((acc, item) => {
      acc[item.platform] = item._count.platform;
      return acc;
    }, {} as Record<string, number>);

    return {
      contentType,
      contentId,
      totalShares,
      byPlatform,
    };
  }

  private async verifyContentExists(contentType: ContentType, contentId: string) {
    let exists = false;

    switch (contentType) {
      case ContentType.VIDEO:
        const video = await this.prisma.video.findUnique({ where: { id: contentId } });
        exists = !!video;
        break;
      case ContentType.BAND:
        const band = await this.prisma.band.findUnique({ where: { id: contentId } });
        exists = !!band;
        break;
      case ContentType.PLAYLIST:
        const playlist = await this.prisma.playlist.findUnique({ where: { id: contentId } });
        exists = !!playlist;
        break;
    }

    if (!exists) {
      throw new NotFoundException(`${contentType} not found`);
    }
  }

  private async incrementShareCount(
    contentType: ContentType,
    contentId: string,
    platform: SharePlatform,
  ) {
    try {
      if (contentType === ContentType.BAND) {
        await this.prisma.bandMetrics.update({
          where: { bandId: contentId },
          data: { totalShares: { increment: 1 } },
        });
      }
      // Video shares are tracked in ContentShare table, no need to increment separately
    } catch (error) {
      // Metrics might not exist, that's ok
    }
  }

  private buildShareWhereClause(contentType: ContentType, contentId: string) {
    switch (contentType) {
      case ContentType.VIDEO:
        return { videoId: contentId };
      case ContentType.BAND:
        return { bandId: contentId };
      case ContentType.PLAYLIST:
        return { playlistId: contentId };
      default:
        return { videoId: contentId };
    }
  }
}
