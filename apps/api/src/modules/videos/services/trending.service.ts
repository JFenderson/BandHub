import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { CacheService } from '@bandhub/cache';

export type TrendingTimeframe = 'today' | 'week' | 'month' | 'all-time';

export interface TrendingVideoFilters {
  timeframe?: TrendingTimeframe;
  categorySlug?: string;
  limit?: number;
}

export interface TrendingVideo {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  qualityScore: number;
  trendingScore: number;
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface TrendingScoreFactors {
  recentViews: number;
  recencyScore: number;
  qualityScore: number;
  engagementScore: number;
}

/**
 * TrendingService - Calculates and manages trending videos
 *
 * Trending Score Formula:
 * (recentViews * 0.4) + (recency * 0.3) + (quality * 0.2) + (engagement * 0.1)
 *
 * With time decay: score decreases over time based on video age
 */
@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);

  private readonly CACHE_TTL = {
    TRENDING_VIDEOS: 3600, // 1 hour cache
  };

  private readonly CACHE_KEY_PREFIX = 'videos:trending:';

  // Weights for trending score calculation
  private readonly WEIGHTS = {
    recentViews: 0.4,
    recency: 0.3,
    quality: 0.2,
    engagement: 0.1,
  };

  // Time decay constants
  private readonly DECAY = {
    HALF_LIFE_HOURS: 48, // Score halves every 48 hours
    MAX_AGE_DAYS: 30, // Consider videos up to 30 days old for trending
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get trending videos with optional filters
   */
  async getTrendingVideos(filters: TrendingVideoFilters = {}): Promise<TrendingVideo[]> {
    const { timeframe = 'week', categorySlug, limit = 20 } = filters;

    const cacheKey = this.buildCacheKey(filters);

    // Check cache first
    const cached = await this.cache.get<TrendingVideo[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for trending videos: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for trending videos: ${cacheKey}`);

    // Calculate trending videos
    const trending = await this.calculateTrendingVideos(timeframe, categorySlug, limit);

    // Cache results for 1 hour
    await this.cache.set(cacheKey, trending, this.CACHE_TTL.TRENDING_VIDEOS);

    return trending;
  }

  /**
   * Calculate trending videos based on weighted algorithm with time decay
   */
  private async calculateTrendingVideos(
    timeframe: TrendingTimeframe,
    categorySlug?: string,
    limit: number = 20,
  ): Promise<TrendingVideo[]> {
    const now = new Date();
    const dateRange = this.getDateRangeForTimeframe(timeframe, now);

    // Build where clause
    const whereClause: any = {
      isHidden: false,
      publishedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    };

    // Add category filter if provided
    if (categorySlug) {
      whereClause.category = {
        slug: categorySlug,
      };
    }

    // Fetch videos with related data
    const videos = await this.prisma.video.findMany({
      where: whereClause,
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
      orderBy: [
        { viewCount: 'desc' },
        { publishedAt: 'desc' },
      ],
      take: limit * 3, // Fetch more to account for scoring/filtering
    });

    // Calculate trending scores for each video
    const scoredVideos = videos.map((video) => {
      const trendingScore = this.calculateTrendingScore(video, now);
      return {
        id: video.id,
        youtubeId: video.youtubeId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        qualityScore: video.qualityScore,
        trendingScore,
        band: video.band,
        category: video.category,
      };
    });

    // Sort by trending score and return top N
    return scoredVideos
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  /**
   * Calculate trending score for a single video
   * Formula: (recentViews * 0.4) + (recency * 0.3) + (quality * 0.2) + (engagement * 0.1)
   */
  private calculateTrendingScore(video: any, now: Date): number {
    const factors = this.calculateScoreFactors(video, now);

    // Normalize each factor to a 0-100 scale
    const normalizedRecentViews = this.normalizeViewCount(factors.recentViews);
    const normalizedRecency = factors.recencyScore; // Already 0-100
    const normalizedQuality = factors.qualityScore; // Already 0-100
    const normalizedEngagement = factors.engagementScore; // Already 0-100

    // Calculate weighted score
    const rawScore =
      normalizedRecentViews * this.WEIGHTS.recentViews +
      normalizedRecency * this.WEIGHTS.recency +
      normalizedQuality * this.WEIGHTS.quality +
      normalizedEngagement * this.WEIGHTS.engagement;

    // Apply time decay
    const decayedScore = this.applyTimeDecay(rawScore, video.publishedAt, now);

    return Math.round(decayedScore * 100) / 100;
  }

  /**
   * Calculate individual score factors
   */
  private calculateScoreFactors(video: any, now: Date): TrendingScoreFactors {
    // Recent views (view count as proxy - in production, you'd track daily/weekly views)
    const recentViews = video.viewCount;

    // Recency score (100 for today, decreasing over time)
    const ageHours = (now.getTime() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60);
    const maxAgeHours = this.DECAY.MAX_AGE_DAYS * 24;
    const recencyScore = Math.max(0, 100 * (1 - ageHours / maxAgeHours));

    // Quality score (direct from video)
    const qualityScore = Math.min(100, video.qualityScore);

    // Engagement score (likes as percentage of views)
    const engagementRate = video.viewCount > 0
      ? (video.likeCount / video.viewCount) * 100
      : 0;
    // Normalize engagement rate (typical good rate is 3-5%)
    const engagementScore = Math.min(100, engagementRate * 20);

    return {
      recentViews,
      recencyScore,
      qualityScore,
      engagementScore,
    };
  }

  /**
   * Normalize view count to 0-100 scale using logarithmic scaling
   */
  private normalizeViewCount(views: number): number {
    if (views <= 0) return 0;
    // Log scale: 1 view = 0, 10 views = 25, 100 = 50, 1000 = 75, 10000+ = 100
    const logViews = Math.log10(views + 1);
    return Math.min(100, logViews * 25);
  }

  /**
   * Apply time decay to score
   * Score halves every HALF_LIFE_HOURS hours
   */
  private applyTimeDecay(score: number, publishedAt: Date, now: Date): number {
    const ageHours = (now.getTime() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

    // Exponential decay formula: score * (0.5)^(age/halfLife)
    const decayFactor = Math.pow(0.5, ageHours / this.DECAY.HALF_LIFE_HOURS);

    return score * decayFactor;
  }

  /**
   * Get date range based on timeframe
   */
  private getDateRangeForTimeframe(
    timeframe: TrendingTimeframe,
    now: Date,
  ): { start: Date; end: Date } {
    const end = now;
    let start: Date;

    switch (timeframe) {
      case 'today':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'all-time':
        // For all-time, use a reasonable range (1 year)
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 7);
    }

    return { start, end };
  }

  /**
   * Build cache key from filters
   */
  private buildCacheKey(filters: TrendingVideoFilters): string {
    const parts = [this.CACHE_KEY_PREFIX];

    parts.push(filters.timeframe || 'week');
    if (filters.categorySlug) parts.push(`cat:${filters.categorySlug}`);
    parts.push(`limit:${filters.limit || 20}`);

    return parts.join(':');
  }

  /**
   * Refresh trending cache for all timeframes
   * Called by scheduled job
   */
  async refreshTrendingCache(): Promise<void> {
    this.logger.log('Starting trending cache refresh...');

    const timeframes: TrendingTimeframe[] = ['today', 'week', 'month', 'all-time'];
    const categories = await this.prisma.category.findMany({
      select: { slug: true },
    });

    // Refresh cache for each timeframe (no category filter)
    for (const timeframe of timeframes) {
      try {
        await this.invalidateCacheForTimeframe(timeframe);
        await this.getTrendingVideos({ timeframe, limit: 20 });
        this.logger.debug(`Refreshed trending cache for timeframe: ${timeframe}`);
      } catch (error) {
        this.logger.error(`Failed to refresh trending cache for ${timeframe}`, error);
      }
    }

    // Refresh cache for each category + timeframe combination
    for (const category of categories) {
      for (const timeframe of timeframes) {
        try {
          await this.invalidateCacheForTimeframe(timeframe, category.slug);
          await this.getTrendingVideos({
            timeframe,
            categorySlug: category.slug,
            limit: 20
          });
          this.logger.debug(`Refreshed trending cache for ${timeframe}/${category.slug}`);
        } catch (error) {
          this.logger.error(
            `Failed to refresh trending cache for ${timeframe}/${category.slug}`,
            error
          );
        }
      }
    }

    this.logger.log('Trending cache refresh completed');
  }

  /**
   * Invalidate cache for a specific timeframe
   */
  private async invalidateCacheForTimeframe(
    timeframe: TrendingTimeframe,
    categorySlug?: string,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey({ timeframe, categorySlug });
    await this.cache.del(cacheKey);
  }

  /**
   * Invalidate all trending caches
   */
  async invalidateAllTrendingCache(): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}*`;
    await this.cache.delPattern(pattern);
    this.logger.log('All trending caches invalidated');
  }
}
