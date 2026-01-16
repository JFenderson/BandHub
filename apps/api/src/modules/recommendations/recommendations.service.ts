import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  async getPersonalizedVideos(userId: string, limit: number = 10) {
    // Get user's watch history and favorite videos to understand preferences
    const [watchHistory, favoriteVideos, followedBands] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where: { userId },
        orderBy: { watchedAt: 'desc' },
        take: 50,
        include: { video: { select: { id: true, bandId: true, categoryId: true } } },
      }),
      this.prisma.favoriteVideo.findMany({
        where: { userId },
        take: 20,
        include: { video: { select: { id: true, bandId: true, categoryId: true } } },
      }),
      this.prisma.userBandFavorite.findMany({
        where: { userId },
        select: { bandId: true },
      }),
    ]);

    // Extract preferred bands and categories
    const preferredBandIds = new Set([
      ...watchHistory.map((h) => h.video.bandId),
      ...favoriteVideos.map((f) => f.video.bandId),
      ...followedBands.map((f) => f.bandId),
    ]);

    const preferredCategoryIds = new Set([
      ...watchHistory.map((h) => h.video.categoryId).filter(Boolean),
      ...favoriteVideos.map((f) => f.video.categoryId).filter(Boolean),
    ]);

    const watchedVideoIds = watchHistory.map((h) => h.video.id);

    // Get videos from preferred bands and categories
    const recommendations = await this.prisma.video.findMany({
      where: {
        isHidden: false,
        OR: [
          { bandId: { in: Array.from(preferredBandIds) } },
          { categoryId: { in: Array.from(preferredCategoryIds) } },
        ],
        NOT: {
          id: { in: watchedVideoIds },
        },
      },
      take: limit,
      orderBy: [
        { viewCount: 'desc' },
        { publishedAt: 'desc' },
      ],
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
      },
    });

    return {
      videos: recommendations.map(v => ({
        ...v,
        metrics: {
          viewCount: v.viewCount,
          likeCount: v.likeCount,
        },
      })),
      reason: 'Based on your watch history and preferences',
    };
  }

  async getTrendingVideos(limit: number = 10) {
    // Get trending videos based on recent views
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingVideos = await this.prisma.video.findMany({
      where: {
        isHidden: false,
        publishedAt: {
          gte: sevenDaysAgo,
        },
      },
      take: limit,
      orderBy: [
        { viewCount: 'desc' },
        { likeCount: 'desc' },
        { publishedAt: 'desc' },
      ],
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
      },
    });

    return {
      videos: trendingVideos.map(v => ({
        ...v,
        metrics: {
          viewCount: v.viewCount,
          likeCount: v.likeCount,
        },
      })),
      reason: 'Trending in the last 7 days',
    };
  }

  async getSimilarVideos(videoId: string, limit: number = 10) {
    // Find the reference video
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: {
        band: true,
        category: true,
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Find similar videos from same band, category, or year
    const similarVideos = await this.prisma.video.findMany({
      where: {
        isHidden: false,
        id: { not: videoId },
        OR: [
          { bandId: video.bandId },
          { categoryId: video.categoryId },
          { eventYear: video.eventYear },
        ],
      },
      take: limit,
      orderBy: [
        { viewCount: 'desc' },
        { publishedAt: 'desc' },
      ],
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
      },
    });

    return {
      videos: similarVideos.map(v => ({
        ...v,
        metrics: {
          viewCount: v.viewCount,
          likeCount: v.likeCount,
        },
      })),
      reason: `Similar to ${video.title}`,
    };
  }

  async getRecommendedBands(userId: string, limit: number = 10) {
    // Get user's watch history to understand band preferences
    const watchHistory = await this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 100,
      include: {
        video: {
          include: {
            band: {
              select: {
                id: true,
                schoolName: true,
                state: true,
              },
            },
          },
        },
      },
    });

    const followedBands = await this.prisma.userBandFavorite.findMany({
      where: { userId },
      select: { bandId: true },
    });

    const followedBandIds = new Set(followedBands.map((f) => f.bandId));

    // Extract states from watch history
    const preferredStates = new Set(
      watchHistory.map((h) => h.video.band.state).filter(Boolean),
    );

    // Find bands from similar locations that user doesn't follow
    const recommendedBands = await this.prisma.band.findMany({
      where: {
        id: { notIn: Array.from(followedBandIds) },
        state: { in: Array.from(preferredStates) },
      },
      take: limit,
      orderBy: [
        { metrics: { totalFollowers: 'desc' } },
        { metrics: { totalViews: 'desc' } },
      ],
      include: {
        metrics: {
          select: {
            totalFollowers: true,
            totalViews: true,
          },
        },
      },
    });

    return {
      bands: recommendedBands.map(b => ({
        ...b,
        metrics: {
          followerCount: b.metrics?.totalFollowers || 0,
          totalViews: b.metrics?.totalViews || 0,
        },
      })),
      reason: 'Based on bands you watch',
    };
  }
}
