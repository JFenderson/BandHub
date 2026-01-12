import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CacheStrategyService, CACHE_TTL, CacheKeyBuilder } from '@bandhub/cache';
import { BandsRepository } from '../bands.repository';
import { CreateBandDto, UpdateBandDto, BandQueryDto } from '../dto';
import { PrismaService } from '@bandhub/database';
import { BandType } from '@prisma/client';

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
   * NOW supports filtering by band type (HBCU or ALL_STAR)
   */
  async findAll(query: BandQueryDto) {
    const cacheKey = CacheKeyBuilder.bandList({
      bandType: query.bandType, // NEW: Include bandType in cache key
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

    // Prepare band data with bandType (defaults to HBCU for backwards compatibility)
    const bandData = {
      ...data,
      slug,
      schoolName: data.schoolName || data.name, // Use name as fallback
      bandType: data.bandType || BandType.HBCU, // NEW: Default to HBCU bandType
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

    const band = await this.bandsRepository.update(id, data);

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
        // Get bands where isFeatured = true
        const result = await this.bandsRepository.findMany({
          page: 1,
          limit: 20,
        });
        
        // Filter on data array, not on result object
        return result.data.filter((band: any) => band.isFeatured);
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
        const featuredBands = await this.getFeaturedBands();
        
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