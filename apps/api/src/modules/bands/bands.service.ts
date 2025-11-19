import { Injectable, NotFoundException } from '@nestjs/common';
import { BandsRepository } from './bands.repository';
import { CacheService } from '../../cache/cache.service';
import { CreateBandDto, UpdateBandDto, BandQueryDto } from './dto';
import { CACHE_KEYS, CACHE_TTL, PaginatedResponse, BandWithVideoCount } from '@hbcu-band-hub/shared';

@Injectable()
export class BandsService {
  constructor(
    private repository: BandsRepository,
    private cache: CacheService,
  ) {}

  async findAll(query: BandQueryDto): Promise<PaginatedResponse<BandWithVideoCount>> {
    const result = await this.repository.findAll(query);

    return {
      data: result.data as BandWithVideoCount[],
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNextPage: result.page * result.limit < result.total,
        hasPreviousPage: result.page > 1,
      },
    };
  }

  async findById(id: string) {
    // Check cache first
    const cacheKey = CACHE_KEYS.BAND_BY_ID(id);
    const cached = await this.cache.get<BandWithVideoCount>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const band = await this.repository.findById(id);
    
    if (!band) {
      throw new NotFoundException(`Band with ID ${id} not found`);
    }

    const result = {
      ...band,
      videoCount: band._count.videos,
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  async findBySlug(slug: string) {
    // Check cache first
    const cacheKey = CACHE_KEYS.BAND_BY_SLUG(slug);
    const cached = await this.cache.get<BandWithVideoCount>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const band = await this.repository.findBySlug(slug);
    
    if (!band) {
      throw new NotFoundException(`Band with slug "${slug}" not found`);
    }

    const result = {
      ...band,
      videoCount: band._count.videos,
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  async create(dto: CreateBandDto) {
    const band = await this.repository.create(dto);
    
    // Invalidate list cache
    await this.cache.delPattern('bands:*');
    
    return band;
  }

  async update(id: string, dto: UpdateBandDto) {
    // Verify band exists
    const existingBand = await this.findById(id);
    
    const band = await this.repository.update(id, dto);
    
    // Invalidate caches
    await this.cache.del(CACHE_KEYS.BAND_BY_ID(id));
    await this.cache.del(CACHE_KEYS.BAND_BY_SLUG(existingBand.slug));
    if (band.slug !== existingBand.slug) {
      await this.cache.del(CACHE_KEYS.BAND_BY_SLUG(band.slug));
    }
    await this.cache.delPattern('bands:list*');
    
    return band;
  }

  async delete(id: string) {
    const band = await this.findById(id);
    
    await this.repository.delete(id);
    
    // Invalidate caches
    await this.cache.del(CACHE_KEYS.BAND_BY_ID(id));
    await this.cache.del(CACHE_KEYS.BAND_BY_SLUG(band.slug));
    await this.cache.delPattern('bands:*');
  }
}