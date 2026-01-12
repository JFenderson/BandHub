import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, TrendDirection } from '@bandhub/database'; // From shared package
import { CacheService } from '@bandhub/cache'; // From shared package

interface TrendingFilters {
  timeframe?: 'today' | 'week' | 'month' | 'all-time';
  state?: string;
  conference?: string;
  category?: string;
  limit?: number;
}

interface TrendingBand {
  id: string;
  name: string;
  nickname: string;
  state: string;
  conference: string;
  logoUrl: string | null;
  metrics: {
    totalViews: number;
    viewsTrending: number;
    trendingScore: number;
    trendDirection: TrendDirection;
    rankChange: number | null;
    videoCount: number;
    recentUploads: number;
    followerCount: number;
    favoriteCount: number;
  };
  latestVideos: Array<{
    id: string;
    title: string;
    thumbnailUrl: string;
    viewCount: number;
    publishedAt: Date;
  }>;
}

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_KEY_PREFIX = 'trending:bands:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService, // Use CacheService
  ) {}

  /**
   * Get trending bands with filters
   */
  async getTrendingBands(filters: TrendingFilters): Promise<TrendingBand[]> {
    const cacheKey = this.buildCacheKey(filters);
    
    // Check cache first
    const cached = await this.cache.get<TrendingBand[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Calculate trending bands
    const trending = await this.calculateTrending(filters);
    
    // Cache results
    await this.cache.set(cacheKey, trending, this.CACHE_TTL);
    
    return trending;
  }

  /**
   * Calculate trending bands based on weighted algorithm
   */
  private async calculateTrending(
    filters: TrendingFilters,
  ): Promise<TrendingBand[]> {
    const { timeframe = 'week', state, conference, limit = 20 } = filters;

    // Build WHERE clause for filters
    const whereClause: any = {};
    
    if (state) {
      whereClause.band = { state };
    }
    
    if (conference) {
      whereClause.band = { ...whereClause.band, conference };
    }

    // Get metrics with band data
    const metrics = await this.prisma.bandMetrics.findMany({
      where: whereClause,
      include: {
        band: {
          include: {
            videos: {
              take: 3,
              orderBy: { publishedAt: 'desc' },
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                viewCount: true,
                publishedAt: true,
              },
            },
            _count: {
              select: {
                favoriteBands: true,
              },
            },
          },
        },
      },
      orderBy: {
        trendingScore: 'desc',
      },
      take: limit,
    });

    // Map to TrendingBand format
    return metrics.map((metric) => {
      const viewsTrending = this.getViewsByTimeframe(metric, timeframe);
      const rankChange = this.calculateRankChange(
        metric.currentRank,
        metric.previousRank,
      );

      return {
        id: metric.band.id,
        name: metric.band.name,
        state: metric.band.state,
        conference: metric.band.conference,
        logoUrl: metric.band.logoUrl,
        metrics: {
          totalViews: metric.totalViews,
          viewsTrending,
          trendingScore: metric.trendingScore,
          trendDirection: metric.trendDirection,
          rankChange,
          videoCount: metric.videoCount,
          recentUploads: metric.recentUploads,
          followerCount: 0, // Set to 0 for now
          favoriteCount: metric.band._count.favoriteBands,
        },
        latestVideos: metric.band.videos.map(video => ({
          ...video,
          publishedAt: video.publishedAt,
        })),
      } as TrendingBand;
    });
  }

  /**
   * Update trending metrics for all bands (called by background job)
   */
  async updateTrendingMetrics(): Promise<void> {
    this.logger.log('Starting trending metrics update...');

    const bands = await this.prisma.band.findMany({
      include: {
        videos: true,
        favoriteBands: true,
        shares: true,
      },
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const band of bands) {
      // Calculate view metrics
      const totalViews = band.videos.reduce((sum, v) => sum + v.viewCount, 0);
      const viewsToday = band.videos
        .filter((v) => v.publishedAt > oneDayAgo)
        .reduce((sum, v) => sum + v.viewCount, 0);
      const viewsThisWeek = band.videos
        .filter((v) => v.publishedAt > oneWeekAgo)
        .reduce((sum, v) => sum + v.viewCount, 0);
      const viewsThisMonth = band.videos
        .filter((v) => v.publishedAt > oneMonthAgo)
        .reduce((sum, v) => sum + v.viewCount, 0);

      // Calculate engagement metrics
      const totalFavorites = band.favoriteBands.length;
      const totalFollowers = 0; // Set to 0 if followers doesn't exist
      const totalShares = band.shares?.length || 0;

      // Calculate content metrics
      const videoCount = band.videos.length;
      const recentUploads = band.videos.filter(
        (v) => v.publishedAt > oneWeekAgo,
      ).length;
      const avgVideoViews = videoCount > 0 ? totalViews / videoCount : 0;

      // Calculate trending score (weighted algorithm)
      const trendingScore = this.calculateTrendingScore({
        viewsThisWeek,
        recentUploads,
        totalFavorites,
        totalFollowers,
        totalShares,
        avgVideoViews,
      });

      // Get previous metrics for rank comparison
      const previousMetrics = await this.prisma.bandMetrics.findUnique({
        where: { bandId: band.id },
      });

      // Determine trend direction
      const trendDirection = this.determineTrendDirection(
        trendingScore,
        previousMetrics?.trendingScore || 0,
      );

      // Update or create metrics
      await this.prisma.bandMetrics.upsert({
        where: { bandId: band.id },
        create: {
          bandId: band.id,
          totalViews,
          viewsToday,
          viewsThisWeek,
          viewsThisMonth,
          totalFavorites,
          totalFollowers,
          totalShares,
          videoCount,
          recentUploads,
          avgVideoViews,
          trendingScore,
          trendDirection,
          lastCalculated: now,
        },
        update: {
          totalViews,
          viewsToday,
          viewsThisWeek,
          viewsThisMonth,
          totalFavorites,
          totalFollowers,
          totalShares,
          videoCount,
          recentUploads,
          avgVideoViews,
          trendingScore,
          trendDirection,
          previousRank: previousMetrics?.currentRank,
          lastCalculated: now,
        },
      });
    }

    // Update current ranks based on trending scores
    await this.updateRankings();

    // Invalidate cache
    await this.invalidateTrendingCache();

    this.logger.log('Trending metrics update completed');
  }

  /**
   * Calculate trending score using weighted algorithm
   */
  private calculateTrendingScore(metrics: {
    viewsThisWeek: number;
    recentUploads: number;
    totalFavorites: number;
    totalFollowers: number;
    totalShares: number;
    avgVideoViews: number;
  }): number {
    const weights = {
      viewsThisWeek: 0.35,
      recentUploads: 0.20,
      totalFavorites: 0.15,
      totalFollowers: 0.10,
      totalShares: 0.10,
      avgVideoViews: 0.10,
    };

    const normalized = {
      viewsThisWeek: Math.log10(metrics.viewsThisWeek + 1),
      recentUploads: metrics.recentUploads * 10,
      totalFavorites: Math.log10(metrics.totalFavorites + 1),
      totalFollowers: Math.log10(metrics.totalFollowers + 1),
      totalShares: Math.log10(metrics.totalShares + 1),
      avgVideoViews: Math.log10(metrics.avgVideoViews + 1),
    };

    const score =
      normalized.viewsThisWeek * weights.viewsThisWeek +
      normalized.recentUploads * weights.recentUploads +
      normalized.totalFavorites * weights.totalFavorites +
      normalized.totalFollowers * weights.totalFollowers +
      normalized.totalShares * weights.totalShares +
      normalized.avgVideoViews * weights.avgVideoViews;

    return Math.round(score * 100) / 100;
  }

  /**
   * Determine trend direction based on score changes
   */
  private determineTrendDirection(
    currentScore: number,
    previousScore: number,
  ): TrendDirection {
    if (previousScore === 0) return TrendDirection.NEW;

    const percentChange = ((currentScore - previousScore) / previousScore) * 100;

    if (percentChange > 10) return TrendDirection.UP;
    if (percentChange < -10) return TrendDirection.DOWN;
    return TrendDirection.STABLE;
  }

  /**
   * Update rankings based on current trending scores
   */
  private async updateRankings(): Promise<void> {
    const metrics = await this.prisma.bandMetrics.findMany({
      orderBy: { trendingScore: 'desc' },
    });

    for (let i = 0; i < metrics.length; i++) {
      await this.prisma.bandMetrics.update({
        where: { id: metrics[i].id },
        data: { currentRank: i + 1 },
      });
    }
  }

  /**
   * Get views by timeframe
   */
  private getViewsByTimeframe(
    metric: any,
    timeframe: 'today' | 'week' | 'month' | 'all-time',
  ): number {
    switch (timeframe) {
      case 'today':
        return metric.viewsToday;
      case 'week':
        return metric.viewsThisWeek;
      case 'month':
        return metric.viewsThisMonth;
      case 'all-time':
        return metric.totalViews;
      default:
        return metric.viewsThisWeek;
    }
  }

  /**
   * Calculate rank change
   */
  private calculateRankChange(
    currentRank: number | null,
    previousRank: number | null,
  ): number | null {
    if (!currentRank || !previousRank) return null;
    return previousRank - currentRank;
  }

  /**
   * Build cache key from filters
   */
  private buildCacheKey(filters: TrendingFilters): string {
    const parts = [this.CACHE_KEY_PREFIX];
    
    if (filters.timeframe) parts.push(filters.timeframe);
    if (filters.state) parts.push(filters.state);
    if (filters.conference) parts.push(filters.conference);
    if (filters.category) parts.push(filters.category);
    
    return parts.join(':');
  }

  /**
   * Invalidate all trending caches
   */
  private async invalidateTrendingCache(): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}*`;
    await this.cache.delPattern(pattern);
  }
}