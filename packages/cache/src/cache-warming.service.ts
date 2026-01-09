import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheStrategyService, CACHE_TTL } from './cache-strategy.service';
import { CacheKeyBuilder } from './dto/cache-key.dto';
import { PrismaService } from '@bandhub/database';

/**
 * CacheWarmingService
 * 
 * Preloads frequently accessed data into cache to improve performance
 * 
 * Warming strategies:
 * 1. On startup - warm critical data immediately
 * 2. Scheduled - refresh popular data every 6 hours
 * 3. On-demand - warm specific data after updates
 * 
 * Benefits:
 * - Eliminates cold starts (first requests are fast)
 * - Predictable performance for popular content
 * - Scheduled refresh keeps cache fresh without user impact
 */
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
private readonly cacheStrategy: CacheStrategyService,
private readonly prisma: PrismaService,
) {}

  /**
   * Warm cache on application startup
   * This runs once when the API starts
   */
  async onModuleInit() {
    this.logger.log('🔥 Starting cache warming on startup...');
    
    try {
      await Promise.all([
        this.warmPopularBands(),
        this.warmCategories(),
        this.warmRecentVideos(),
      ]);
      
      this.logger.log('✅ Cache warming on startup complete');
    } catch (error) {
      this.logger.error('❌ Cache warming on startup failed:', error);
    }
  }

  /**
   * Scheduled cache warming (every 6 hours)
   * Keeps popular data fresh in cache
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledWarmup() {
    this.logger.log('🔥 Running scheduled cache warmup...');
    
    try {
      await Promise.all([
        this.warmPopularBands(),
        this.warmTrendingVideos(),
        this.warmPopularVideosByBand(),
      ]);
      
      this.logger.log('✅ Scheduled cache warmup complete');
    } catch (error) {
      this.logger.error('❌ Scheduled cache warmup failed:', error);
    }
  }

  /**
   * Warm top 20 bands by video count
   * These are the most frequently accessed bands
   */
  async warmPopularBands(): Promise<void> {
    try {
      const popularBands = await this.prisma.band.findMany({
        take: 20,
        orderBy: {
          videos: {
            _count: 'desc',
          },
        },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      });

      // Warm each band's profile cache
      for (const band of popularBands) {
        const key = CacheKeyBuilder.bandProfile(band.id);
        await this.cacheStrategy.set(key, band, CACHE_TTL.BAND_PROFILE, true);
      }

      // Also cache the popular bands list itself
      const popularKey = CacheKeyBuilder.popularBands(20);
      await this.cacheStrategy.set(popularKey, popularBands, CACHE_TTL.POPULAR_BANDS, true);

      this.logger.log(`Warmed ${popularBands.length} popular band profiles`);
    } catch (error) {
      this.logger.error('Failed to warm popular bands:', error);
    }
  }

  /**
   * Warm trending videos (top 50 by view count)
   * These are frequently displayed on the homepage
   */
  async warmTrendingVideos(): Promise<void> {
    try {
      const trendingVideos = await this.prisma.video.findMany({
        take: 50,
        orderBy: { viewCount: 'desc' },
        where: { isHidden: false },
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
          creator: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      });

      const key = CacheKeyBuilder.trendingVideos(50);
      await this.cacheStrategy.set(
        key,
        trendingVideos,
        CACHE_TTL.TRENDING_VIDEOS,
        true,
      );

      this.logger.log(`Warmed ${trendingVideos.length} trending videos`);
    } catch (error) {
      this.logger.error('Failed to warm trending videos:', error);
    }
  }

  /**
   * Warm recent videos (last 100 added)
   * Used for admin dashboard and recent videos page
   */
  async warmRecentVideos(): Promise<void> {
    try {
      const recentVideos = await this.prisma.video.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        where: { isHidden: false },
        include: {
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const key = CacheKeyBuilder.dashboardRecentVideos(100);
      await this.cacheStrategy.set(
        key,
        recentVideos,
        CACHE_TTL.DASHBOARD_STATS,
        true,
      );

      this.logger.log(`Warmed ${recentVideos.length} recent videos`);
    } catch (error) {
      this.logger.error('Failed to warm recent videos:', error);
    }
  }

  /**
   * Warm all categories
   * Categories are used in filters and navigation
   */
  async warmCategories(): Promise<void> {
    try {
      const categories = await this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      });

      const key = CacheKeyBuilder.categories();
      await this.cacheStrategy.set(key, categories, CACHE_TTL.CATEGORIES, false);

      this.logger.log(`Warmed ${categories.length} categories`);
    } catch (error) {
      this.logger.error('Failed to warm categories:', error);
    }
  }

  /**
   * Warm popular videos for top bands
   * Pre-caches the "top 10 videos" for each popular band
   */
  async warmPopularVideosByBand(): Promise<void> {
    try {
      // Get top 10 bands
      const topBands = await this.prisma.band.findMany({
        take: 10,
        orderBy: {
          videos: {
            _count: 'desc',
          },
        },
        select: { id: true, name: true },
      });

      // Warm popular videos for each band
      for (const band of topBands) {
        const videos = await this.prisma.video.findMany({
          take: 10,
          where: {
            bandId: band.id,
            isHidden: false,
          },
          orderBy: { viewCount: 'desc' },
          include: {
            category: true,
            creator: {
              select: {
                id: true,
                name: true,
                isVerified: true,
              },
            },
          },
        });

        const key = CacheKeyBuilder.popularVideosByBand(band.id, 10);
        await this.cacheStrategy.set(key, videos, CACHE_TTL.POPULAR_BANDS, true);
      }

      this.logger.log(`Warmed popular videos for ${topBands.length} bands`);
    } catch (error) {
      this.logger.error('Failed to warm popular videos by band:', error);
    }
  }

  /**
   * On-demand warming for a specific band
   * Call this after band updates or new videos added
   */
  async warmBand(bandId: string): Promise<void> {
    try {
      const band = await this.prisma.band.findUnique({
        where: { id: bandId },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      });

      if (!band) {
        this.logger.warn(`Cannot warm band ${bandId}: not found`);
        return;
      }

      // Warm band profile
      const profileKey = CacheKeyBuilder.bandProfile(bandId);
      await this.cacheStrategy.set(profileKey, band, CACHE_TTL.BAND_PROFILE, true);

      // Warm popular videos for this band
      const videos = await this.prisma.video.findMany({
        take: 10,
        where: { bandId, isHidden: false },
        orderBy: { viewCount: 'desc' },
        include: {
          category: true,
          creator: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      });

      const videosKey = CacheKeyBuilder.popularVideosByBand(bandId, 10);
      await this.cacheStrategy.set(videosKey, videos, CACHE_TTL.POPULAR_BANDS, true);

      this.logger.log(`Warmed band ${band.name} (${videos.length} videos)`);
    } catch (error) {
      this.logger.error(`Failed to warm band ${bandId}:`, error);
    }
  }

  /**
   * Warm all caches (use sparingly - expensive!)
   * Only call this during off-peak hours or after major data changes
   */
  async warmAll(): Promise<void> {
    this.logger.warn('🔥 Starting FULL cache warming (expensive operation)...');
    
    const startTime = Date.now();
    
    try {
      await Promise.all([
        this.warmPopularBands(),
        this.warmTrendingVideos(),
        this.warmRecentVideos(),
        this.warmCategories(),
        this.warmPopularVideosByBand(),
      ]);
      
      const duration = Date.now() - startTime;
      this.logger.log(`✅ Full cache warming complete in ${duration}ms`);
    } catch (error) {
      this.logger.error('❌ Full cache warming failed:', error);
    }
  }
}