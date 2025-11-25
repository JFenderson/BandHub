import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../cache/cache.service';
import { BandsRepository } from './bands.repository';
import { CreateBandDto, UpdateBandDto, BandQueryDto, UpdateFeaturedOrderDto } from './dto';
import { PrismaService } from '../../database/prisma.service';
import { unlink } from 'fs/promises';
import { join } from 'path';

const MAX_FEATURED_BANDS = 8;

@Injectable()
export class BandsService {
  constructor(
    private readonly bandsRepository: BandsRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async findAll(query: BandQueryDto) {
    // Create a cache key from the query parameters
    const cacheKey = `bands:${JSON.stringify(query)}`;
    
    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const result = await this.bandsRepository.findMany(query);

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  async findById(id: string) {
    const cacheKey = `band:${id}`;
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const band = await this.bandsRepository.findById(id);
    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Cache for 30 minutes
    await this.cacheService.set(cacheKey, band, 1800);

    return band;
  }

  async findBySlug(slug: string) {
    const cacheKey = `band:slug:${slug}`;
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const band = await this.bandsRepository.findBySlug(slug);
    if (!band) {
      throw new NotFoundException(`Band with slug "${slug}" not found`);
    }

    // Cache for 30 minutes
    await this.cacheService.set(cacheKey, band, 1800);

    return band;
  }

  async create(data: CreateBandDto) {
    // Generate slug from name
    const slug = this.generateSlug(data.name);

    // Check if slug already exists
    try {
      await this.findBySlug(slug);
      throw new BadRequestException(`Band with slug "${slug}" already exists`);
    } catch (error) {
      // If NotFoundException, that's good - slug is available
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }

    // Map frontend DTO fields to Prisma-compatible fields
    const createData = this.mapDtoToCreateData(data, slug);

    const band = await this.bandsRepository.create(createData);

    // Invalidate related caches
    await this.invalidateBandsCaches();

    return band;
  }

  async update(id: string, data: UpdateBandDto) {
    // Check if band exists
    const existing = await this.bandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Map frontend DTO fields to Prisma-compatible fields
    const updateData = this.mapDtoToUpdateData(data);

    // If name is being updated, regenerate slug
    if (data.name && data.name !== existing.name) {
      const newSlug = this.generateSlug(data.name);
      updateData.slug = newSlug;
      
      // Check if new slug conflicts with existing band
      try {
        const conflicting = await this.bandsRepository.findBySlug(newSlug);
        if (conflicting && conflicting.id !== id) {
          throw new BadRequestException(`Band with slug "${newSlug}" already exists`);
        }
      } catch (error) {
        // If NotFoundException, that's good - slug is available
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    try {
      const band = await this.bandsRepository.update(id, updateData);

      // Invalidate caches
      await this.invalidateBandsCaches();
      await this.cacheService.del(`band:${id}`);
      await this.cacheService.del(`band:slug:${existing.slug}`);

      return band;
    } catch (error) {
      console.error('Error updating band:', error);
      throw error;
    }
  }

  async delete(id: string) {
    // Check if band exists
    const existing = await this.bandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    await this.bandsRepository.delete(id);

    // Invalidate caches
    await this.invalidateBandsCaches();
    await this.cacheService.del(`band:${id}`);
    await this.cacheService.del(`band:slug:${existing.slug}`);

    return { message: 'Band deleted successfully' };
  }

  async getStats() {
    const cacheKey = 'bands:stats';
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await this.bandsRepository.getBandStats();

    // Cache stats for 1 hour
    await this.cacheService.set(cacheKey, stats, 3600);

    return stats;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async invalidateBandsCaches() {
    // Clear all band list caches
    const patterns = ['bands:*', 'bands:stats'];
    
    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }

  /**
   * Maps frontend DTO fields to Prisma-compatible fields for create operations
   * Handles field name differences between frontend and database schema
   */
  private mapDtoToCreateData(data: CreateBandDto, slug: string): Prisma.BandCreateInput {
    // Get school name from either 'school' or 'schoolName' field
    const schoolName = data.school || data.schoolName || '';

    const prismaData: Prisma.BandCreateInput = {
      name: data.name,
      slug,
      schoolName,
      city: data.city,
      state: data.state,
      conference: data.conference,
      description: data.description,
      foundedYear: data.foundedYear,
      youtubeChannelId: data.youtubeChannelId,
      youtubePlaylistIds: data.youtubePlaylistIds || [],
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
    };

    return prismaData;
  }

  /**
   * Maps frontend DTO fields to Prisma-compatible fields for update operations
   * Handles field name differences between frontend and database schema
   */
  private mapDtoToUpdateData(data: UpdateBandDto): Prisma.BandUpdateInput {
    const prismaData: Prisma.BandUpdateInput = {};

    // Map 'school' to 'schoolName' (frontend uses 'school', Prisma uses 'schoolName')
    if (data.school !== undefined) {
      prismaData.schoolName = data.school;
    }
    if (data.schoolName !== undefined) {
      prismaData.schoolName = data.schoolName;
    }

    // Map name if provided
    if (data.name !== undefined) {
      prismaData.name = data.name;
    }

    // Map fields that exist in both frontend DTO and Prisma schema
    if (data.city !== undefined) prismaData.city = data.city;
    if (data.state !== undefined) prismaData.state = data.state;
    if (data.conference !== undefined) prismaData.conference = data.conference;
    if (data.description !== undefined) prismaData.description = data.description;
    if (data.foundedYear !== undefined) prismaData.foundedYear = data.foundedYear;
    if (data.youtubeChannelId !== undefined) prismaData.youtubeChannelId = data.youtubeChannelId;
    if (data.youtubePlaylistIds !== undefined) prismaData.youtubePlaylistIds = data.youtubePlaylistIds;
    if (data.isActive !== undefined) prismaData.isActive = data.isActive;
    if (data.isFeatured !== undefined) prismaData.isFeatured = data.isFeatured;
    if (data.logoUrl !== undefined) prismaData.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) prismaData.bannerUrl = data.bannerUrl;

    // Note: Fields like 'nickname', 'division', 'founded', 'colors', 'website' from frontend
    // are intentionally not mapped as they don't exist in the Prisma schema

    return prismaData;
  }

  async updateLogo(id: string, logoUrl: string) {
    const band = await this.prismaService.band.findUnique({
      where: { id },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Delete old logo file if it exists
    if (band.logoUrl) {
      try {
        const oldFilePath = join(process.cwd(), 'uploads', 'logos', band.logoUrl.split('/').pop()!);
        await unlink(oldFilePath);
      } catch (error) {
        // File might not exist, that's okay
        console.warn('Could not delete old logo:', error);
      }
    }

    return this.prismaService.band.update({
      where: { id },
      data: { logoUrl },
    });
  }

  async updateBanner(id: string, bannerUrl: string) {
    const band = await this.prismaService.band.findUnique({
      where: { id },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Delete old banner file if it exists
    if (band.bannerUrl) {
      try {
        const oldFilePath = join(process.cwd(), 'uploads', 'banners', band.bannerUrl.split('/').pop()!);
        await unlink(oldFilePath);
      } catch (error) {
        // File might not exist, that's okay
        console.warn('Could not delete old banner:', error);
      }
    }

    return this.prismaService.band.update({
      where: { id },
      data: { bannerUrl },
    });
  }

  async deleteLogo(id: string) {
    const band = await this.prismaService.band.findUnique({
      where: { id },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    if (!band.logoUrl) {
      throw new NotFoundException('Band has no logo to delete');
    }

    // Delete file from disk
    try {
      const filePath = join(process.cwd(), 'uploads', 'logos', band.logoUrl.split('/').pop()!);
      await unlink(filePath);
    } catch (error) {
      console.warn('Could not delete logo file:', error);
    }

    return this.prismaService.band.update({
      where: { id },
      data: { logoUrl: null },
    });
  }

  // =====================================
  // FEATURED BANDS METHODS
  // =====================================

  /**
   * Get all featured bands ordered by featuredOrder
   */
  async getFeaturedBands() {
    const cacheKey = 'bands:featured';
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const featuredBands = await this.prismaService.band.findMany({
      where: {
        isFeatured: true,
        isActive: true,
      },
      orderBy: {
        featuredOrder: 'asc',
      },
      include: {
        videos: {
          where: { isHidden: false },
          orderBy: { publishedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            viewCount: true,
            publishedAt: true,
          },
        },
        _count: {
          select: {
            videos: {
              where: { isHidden: false },
            },
          },
        },
      },
    });

    const response = {
      bands: featuredBands.map(band => ({
        id: band.id,
        name: band.name,
        school: band.schoolName,
        description: band.description,
        logoUrl: band.logoUrl,
        slug: band.slug,
        schoolColors: this.parseSchoolColors(band.description),
        videoCount: band._count.videos,
        recentVideos: band.videos,
        featuredOrder: band.featuredOrder || 0,
        featuredSince: band.featuredSince,
      })),
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, response, 300);

    return response;
  }

  /**
   * Toggle featured status for a band
   */
  async toggleFeatured(bandId: string) {
    const band = await this.prismaService.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    if (band.isFeatured) {
      // Unfeaturing - remove featured status
      const updatedBand = await this.prismaService.band.update({
        where: { id: bandId },
        data: {
          isFeatured: false,
          featuredOrder: null,
          // Keep featuredSince for historical tracking
        },
      });

      // Reorder remaining featured bands
      await this.reorderFeaturedBands();
      await this.invalidateFeaturedCaches();

      return updatedBand;
    } else {
      // Featuring - check max limit
      const featuredCount = await this.prismaService.band.count({
        where: { isFeatured: true },
      });

      if (featuredCount >= MAX_FEATURED_BANDS) {
        throw new BadRequestException(
          `Maximum of ${MAX_FEATURED_BANDS} featured bands allowed. Please unfeature a band first.`,
        );
      }

      // Get next available order position
      const nextOrder = featuredCount + 1;

      const updatedBand = await this.prismaService.band.update({
        where: { id: bandId },
        data: {
          isFeatured: true,
          featuredOrder: nextOrder,
          featuredSince: band.featuredSince || new Date(),
        },
      });

      await this.invalidateFeaturedCaches();

      return updatedBand;
    }
  }

  /**
   * Bulk update featured order for multiple bands
   */
  async updateFeaturedOrder(data: UpdateFeaturedOrderDto) {
    // Validate all bands exist and are featured
    const bandIds = data.bands.map(b => b.id);
    const bands = await this.prismaService.band.findMany({
      where: {
        id: { in: bandIds },
        isFeatured: true,
      },
    });

    if (bands.length !== bandIds.length) {
      throw new BadRequestException('Some bands are not featured or do not exist');
    }

    // Validate order numbers are unique and within range
    const orders = new Set(data.bands.map(b => b.featuredOrder));
    if (orders.size !== data.bands.length) {
      throw new BadRequestException('Featured order values must be unique');
    }

    // Update each band's order
    await this.prismaService.$transaction(
      data.bands.map(item =>
        this.prismaService.band.update({
          where: { id: item.id },
          data: { featuredOrder: item.featuredOrder },
        }),
      ),
    );

    await this.invalidateFeaturedCaches();

    return { message: 'Featured order updated successfully' };
  }

  /**
   * Track click on featured band
   */
  async trackFeaturedClick(bandId: string, sessionId?: string) {
    const band = await this.prismaService.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    await this.prismaService.featuredBandClick.create({
      data: {
        bandId,
        sessionId,
      },
    });

    return { message: 'Click tracked successfully' };
  }

  /**
   * Get featured bands analytics
   */
  async getFeaturedAnalytics() {
    const featuredBands = await this.prismaService.band.findMany({
      where: { isFeatured: true },
      include: {
        _count: {
          select: {
            featuredClicks: true,
          },
        },
      },
    });

    // Get total page views for CTR calculation (simplified estimate)
    const totalClicks = await this.prismaService.featuredBandClick.count();
    
    // Calculate analytics for each featured band
    const analytics = featuredBands.map(band => {
      const daysFeatured = band.featuredSince
        ? Math.max(1, Math.floor((Date.now() - new Date(band.featuredSince).getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      return {
        bandId: band.id,
        bandName: band.name,
        totalClicks: band._count.featuredClicks,
        clickThroughRate: totalClicks > 0 ? (band._count.featuredClicks / totalClicks) * 100 : 0,
        averagePosition: band.featuredOrder || 0,
        daysFeatured,
      };
    });

    // Find best performing position
    const clicksByPosition = await this.prismaService.featuredBandClick.groupBy({
      by: ['bandId'],
      _count: true,
    });

    const positionPerformance = new Map<number, number>();
    for (const click of clicksByPosition) {
      const band = featuredBands.find(b => b.id === click.bandId);
      if (band && band.featuredOrder) {
        const current = positionPerformance.get(band.featuredOrder) || 0;
        positionPerformance.set(band.featuredOrder, current + click._count);
      }
    }

    let bestPosition = 1;
    let maxClicks = 0;
    positionPerformance.forEach((clicks, position) => {
      if (clicks > maxClicks) {
        maxClicks = clicks;
        bestPosition = position;
      }
    });

    return {
      analytics,
      totalFeaturedClicks: totalClicks,
      averageCTR: featuredBands.length > 0 ? 100 / featuredBands.length : 0,
      bestPerformingPosition: bestPosition,
    };
  }

  /**
   * Helper: Reorder featured bands after one is removed
   */
  private async reorderFeaturedBands() {
    const featuredBands = await this.prismaService.band.findMany({
      where: { isFeatured: true },
      orderBy: { featuredOrder: 'asc' },
    });

    await this.prismaService.$transaction(
      featuredBands.map((band, index) =>
        this.prismaService.band.update({
          where: { id: band.id },
          data: { featuredOrder: index + 1 },
        }),
      ),
    );
  }

  /**
   * Helper: Parse school colors from description (simplified)
   * In a real implementation, this would be stored in a separate field
   */
  private parseSchoolColors(description: string | null): { primary: string; secondary: string } | undefined {
    // Default colors if no specific colors found
    return {
      primary: '#1e3a5f',
      secondary: '#c5a900',
    };
  }

  /**
   * Helper: Invalidate featured bands caches
   */
  private async invalidateFeaturedCaches() {
    await this.cacheService.del('bands:featured');
    await this.invalidateBandsCaches();
  }
}