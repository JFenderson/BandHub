import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService, TrendDirection } from '@bandhub/database';

@Processor('trending-metrics')
export class TrendingMetricsProcessor extends WorkerHost {
  private readonly logger = new Logger(TrendingMetricsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing trending metrics job ${job.id}`);

    try {
      await this.updateTrendingMetrics();
      this.logger.log('Trending metrics updated successfully');
    } catch (error) {
      this.logger.error(`Error updating trending metrics: ${error.message}`);
      throw error;
    }
  }

  private async updateTrendingMetrics(): Promise<void> {
    const bands = await this.prisma.band.findMany({
      include: {
        videos: true,
        userFavorites: true,
        shares: true,
      },
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const band of bands) {
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

      const totalFavorites = band.userFavorites.length;
      const totalFollowers = 0;
      const totalShares = band.shares?.length || 0;
      const videoCount = band.videos.length;
      const recentUploads = band.videos.filter((v) => v.publishedAt > oneWeekAgo).length;
      const avgVideoViews = videoCount > 0 ? totalViews / videoCount : 0;

      const trendingScore = this.calculateTrendingScore({
        viewsThisWeek,
        recentUploads,
        totalFavorites,
        totalFollowers,
        totalShares,
        avgVideoViews,
      });

      const previousMetrics = await this.prisma.bandMetrics.findUnique({
        where: { bandId: band.id },
      });

      const trendDirection = this.determineTrendDirection(
        trendingScore,
        previousMetrics?.trendingScore || 0,
      );

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

    await this.updateRankings();
  }

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

  private determineTrendDirection(currentScore: number, previousScore: number): TrendDirection {
    if (previousScore === 0) return TrendDirection.NEW;
    const percentChange = ((currentScore - previousScore) / previousScore) * 100;
    if (percentChange > 10) return TrendDirection.UP;
    if (percentChange < -10) return TrendDirection.DOWN;
    return TrendDirection.STABLE;
  }

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
}