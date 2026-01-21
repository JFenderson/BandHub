import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CacheStrategyService, CACHE_TTL, CacheKeyBuilder } from '@bandhub/cache';
import { BandsRepository } from '../bands.repository';
import { CreateBandDto, UpdateBandDto, BandQueryDto } from '../dto';
import { PrismaService } from '@bandhub/database';
import { BandType } from '@prisma/client';
import { CursorPaginatedResponse } from '../../../common';

/**
 * BandsService with comprehensive caching
 * 
 * Caching strategy:
 * - Band profiles: 1 hour (rarely change)
 * - Band lists: 1 hour (invalidated on create/update/delete)
 * - Band stats: 30 minutes (change as videos added)
 * 
 * Invalidation triggers:
 * - Band update -> invalidate that band's caches + lists
 * - New video added -> invalidate band stats
 * - Band deleted -> invalidate that band's caches + lists
 */
@Injectable()
export class BandsService {
  private readonly logger = new Logger(BandsService.name);

  constructor(
    private readonly bandsRepository: BandsRepository,
    private readonly cacheStrategy: CacheStrategyService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find all bands with filters
   * Caches each unique filter combination
   * Supports both offset-based and cursor-based pagination
   */
  async findAll(query: BandQueryDto) {
    // If cursor is provided, use cursor-based pagination
    if (query.cursor) {
      return this.findAllWithCursor(query);
    }

    const cacheKey = CacheKeyBuilder.bandList({
      bandType: query.bandType,
      search: query.search,
      state: query.state,
      page: query.page,
      limit: query.limit,
    });

    return this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.findMany(query),
      CACHE_TTL.BAND_LIST,
    );
  }

  /**
   * Find all bands with cursor-based pagination
   * More efficient for large datasets and infinite scroll UIs
   */
  async findAllWithCursor(
    query: Omit<BandQueryDto, 'page'> & { cursor?: string },
  ): Promise<CursorPaginatedResponse<any>> {
    // Build cache key for cursor-based queries
    const cacheKey = `bands:cursor:${query.cursor || 'start'}:${query.bandType || 'all'}:${query.search || ''}:${query.state || ''}:${query.limit || 20}:${query.sortBy || 'name'}:${query.sortOrder || 'asc'}`;

    return this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.findManyWithCursorPagination(query),
      CACHE_TTL.BAND_LIST,
    );
  }

  /**
   * Find band by ID
   * Heavily cached as band profiles rarely change
   */
  async findById(id: string) {
    const cacheKey = CacheKeyBuilder.bandProfile(id);

    const band = await this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.findById(id),
      CACHE_TTL.BAND_PROFILE,
    );

    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    return band;
  }

  /**
   * Find band by slug
   * Used for public-facing URLs like /bands/jackson-state-university or /bands/georgia-all-star-mass-band
   */
  async findBySlug(slug: string) {
    // Use slug in cache key for direct lookups
    const cacheKey = `bands:profile:slug:${slug}`;

    const band = await this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.findBySlug(slug),
      CACHE_TTL.BAND_PROFILE,
    );

    if (!band) {
      throw new NotFoundException(`Band with slug ${slug} not found`);
    }

    return band;
  }

  /**
   * Create new band
   * Invalidates band lists
   * NOW defaults to HBCU type unless specified
   */
  async create(data: CreateBandDto) {
    // Generate slug from name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Transform DTO fields to match Prisma schema
    // The frontend sends 'school' but Prisma expects 'schoolName'
    // Strip out fields that don't exist in Prisma schema (nickname, division, colors, website, founded)
    const bandData = {
      name: data.name,
      slug,
      schoolName: data.schoolName || data.school || data.name, // Use school or name as fallback
      bandType: data.bandType || BandType.HBCU,
      city: data.city || null,
      state: data.state || '',
      conference: data.conference || null,
      description: data.description || null,
      foundedYear: data.foundedYear || data.founded || null,
      youtubeChannelId: data.youtubeChannelId || null,
      youtubePlaylistIds: data.youtubePlaylistIds || [],
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
    };

    const band = await this.bandsRepository.create(bandData);

    // Invalidate all band lists since we added a new band
    await this.cacheStrategy.invalidatePattern('bands:list:*');
    await this.cacheStrategy.invalidatePattern('popular:bands:*');

    this.logger.log(`Created ${band.bandType} band: ${band.name} (${band.id})`);

    return band;
  }

  /**
   * Update band
   * Invalidates that band's caches + lists
   */
  async update(id: string, data: UpdateBandDto) {
    const existing = await this.bandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Transform DTO fields to match Prisma schema
    // The frontend sends 'school' but Prisma expects 'schoolName'
    // Also strip out fields that don't exist in Prisma schema
    const prismaData = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.schoolName !== undefined && { schoolName: data.schoolName }),
      ...((data.school !== undefined && data.schoolName === undefined) && { schoolName: data.school }),
      ...(data.city !== undefined && { city: data.city || null }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.conference !== undefined && { conference: data.conference || null }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
      ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl || null }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.foundedYear !== undefined && { foundedYear: data.foundedYear || null }),
      ...(data.youtubeChannelId !== undefined && { youtubeChannelId: data.youtubeChannelId || null }),
      ...(data.youtubePlaylistIds !== undefined && { youtubePlaylistIds: data.youtubePlaylistIds }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      ...(data.type !== undefined && { bandType: data.type }),
      ...(data.slug !== undefined && { slug: data.slug }),
    };

    const band = await this.bandsRepository.update(id, prismaData);

    // Invalidate this band's caches
    await this.cacheStrategy.invalidateBandCaches(id);

    this.logger.log(`Updated band: ${band.name} (${band.id})`);

    return band;
  }

  /**
   * Delete band
   * Invalidates that band's caches + lists
   */
  async delete(id: string) {
    const existing = await this.bandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    await this.bandsRepository.delete(id);

    // Invalidate this band's caches
    await this.cacheStrategy.invalidateBandCaches(id);

    this.logger.log(`Deleted band: ${existing.name} (${id})`);

    return { message: 'Band deleted successfully' };
  }

  /**
   * Get band statistics
   * Cached for 30 minutes as it changes when videos added
   */
  async getBandStats(id: string) {
    const cacheKey = CacheKeyBuilder.bandStats(id);

    return this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.getBandStats(id),
      CACHE_TTL.BAND_STATS,
    );
  }

  /**
   * Get popular bands
   * Cached for 1 hour, refreshed by cache warming
   */
  async getPopularBands(limit = 10) {
    const cacheKey = CacheKeyBuilder.popularBands(limit);

    return this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.getPopularBands(limit),
      CACHE_TTL.POPULAR_BANDS,
    );
  }

  /**
   * Search bands by name or school
   * Cached for 30 minutes
   */
  async search(query: string) {
    const cacheKey = CacheKeyBuilder.searchResults(query, { type: 'bands' });

    return this.cacheStrategy.wrap(
      cacheKey,
      () => this.bandsRepository.search(query),
      CACHE_TTL.SEARCH_RESULTS,
    );
  }

  /**
   * Get featured bands
   * Called by GET /bands/featured endpoint
   */
  async getFeaturedBands() {
    const cacheKey = 'bands:featured';

    return this.cacheStrategy.wrap(
      cacheKey,
      async () => {
        // Query bands where isFeatured = true directly from database
        const result = await this.bandsRepository.findMany({
          page: 1,
          limit: 20,
          isFeatured: true,
        });

        // Sort by featuredOrder and return in expected format
        const sortedBands = result.data.sort((a: any, b: any) =>
          (a.featuredOrder || 999) - (b.featuredOrder || 999)
        );

        return { bands: sortedBands };
      },
      CACHE_TTL.BAND_LIST,
    );
  }

  /**
   * Get featured analytics
   * Called by GET /bands/featured/analytics endpoint
   */
  async getFeaturedAnalytics() {
    const cacheKey = 'bands:featured:analytics';

    return this.cacheStrategy.wrap(
      cacheKey,
      async () => {
        const featuredResult = await this.getFeaturedBands();
        const featuredBands = featuredResult.bands || [];

        return {
          totalFeatured: featuredBands.length,
          totalVideos: featuredBands.reduce((sum, band: any) => sum + (band._count?.videos || 0), 0),
          averageVideosPerBand: featuredBands.length > 0
            ? Math.round(featuredBands.reduce((sum, band: any) => sum + (band._count?.videos || 0), 0) / featuredBands.length)
            : 0,
        };
      },
      CACHE_TTL.BAND_STATS,
    );
  }

  /**
   * NEW: Get all-star bands specifically
   * Called by GET /bands/all-stars endpoint
   */
  async getAllStarBands() {
    const cacheKey = 'bands:all-star:list';

    return this.cacheStrategy.wrap(
      cacheKey,
      async () => {
        const result = await this.bandsRepository.findMany({
          bandType: BandType.ALL_STAR,
          page: 1,
          limit: 100, // All-star bands are limited in number (15-20 total)
          sortBy: 'name',
          sortOrder: 'asc',
        });
        
        return result.data;
      },
      CACHE_TTL.BAND_LIST,
    );
  }

  /**
   * Update band logo
   * Called by PATCH /bands/:id/logo endpoint
   */
  async updateLogo(id: string, logoUrl: string) {
    const band = await this.update(id, { logoUrl });
    
    this.logger.log(`Updated logo for band: ${band.name}`);
    
    return band;
  }

  /**
   * Update band banner
   * Called by PATCH /bands/:id/banner endpoint
   */
  async updateBanner(id: string, bannerUrl: string) {
    const band = await this.update(id, { bannerUrl });
    
    this.logger.log(`Updated banner for band: ${band.name}`);
    
    return band;
  }

  /**
   * Track featured band click
   * Called by POST /bands/:id/featured/track-click endpoint
   */
  async trackFeaturedClick(id: string, sessionId?: string) {
    // This would typically increment a click counter
    // For now, just log it
    this.logger.log(`Featured click tracked for band ${id} (session: ${sessionId})`);
    
    return { success: true, bandId: id };
  }

  /**
   * Toggle featured status
   * Called by PATCH /admin/bands/:id/featured endpoint
   */
  async toggleFeatured(id: string) {
    const band = await this.bandsRepository.findById(id);
    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    // Toggle the featured status
    const updated = await this.bandsRepository.update(id, {
      isFeatured: !band.isFeatured,
    });

    // Invalidate featured caches
    await this.cacheStrategy.invalidatePattern('bands:featured*');
    await this.cacheStrategy.invalidateBandCaches(id);

    this.logger.log(`Toggled featured status for band: ${updated.name} (${updated.isFeatured})`);

    return updated;
  }

  /**
   * Update featured order
   * Called by PATCH /admin/bands/featured/order endpoint
   */
  async updateFeaturedOrder(data: { bandIds: string[] }) {
    // Update the display order of featured bands
    for (let i = 0; i < data.bandIds.length; i++) {
      const bandId = data.bandIds[i];
      await this.bandsRepository.update(bandId, {
        featuredOrder: i,
      } as any);
    }

    // Invalidate featured caches
    await this.cacheStrategy.invalidatePattern('bands:featured*');

    this.logger.log(`Updated featured order for ${data.bandIds.length} bands`);

    return { success: true, count: data.bandIds.length };
  }
}