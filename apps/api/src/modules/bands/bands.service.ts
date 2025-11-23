import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { BandsRepository } from './bands.repository';
import { CreateBandDto, UpdateBandDto, BandQueryDto } from './dto';
import { PrismaService } from '../../database/prisma.service';
import { unlink } from 'fs/promises';
import { join } from 'path';

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

    const createData = {
      ...data,
      slug,
    };

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

    // Create a mutable copy of the update data
    const updateData: UpdateBandDto & { slug?: string } = { ...data };

    // If name is being updated, regenerate slug
    if (data.name && data.name !== existing.name) {
      updateData.slug = this.generateSlug(data.name);
      
      // Check if new slug conflicts with existing band
      try {
        const conflicting = await this.bandsRepository.findBySlug(updateData.slug);
        if (conflicting && conflicting.id !== id) {
          throw new BadRequestException(`Band with slug "${updateData.slug}" already exists`);
        }
      } catch (error) {
        // If NotFoundException, that's good - slug is available
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    const band = await this.bandsRepository.update(id, updateData);

    // Invalidate caches
    await this.invalidateBandsCaches();
    await this.cacheService.del(`band:${id}`);
    await this.cacheService.del(`band:slug:${existing.slug}`);

    return band;
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
        const oldFilePath = join(process.cwd(), 'uploads', 'bands', band.logoUrl.split('/').pop()!);
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
      const filePath = join(process.cwd(), 'uploads', 'bands', band.logoUrl.split('/').pop()!);
      await unlink(filePath);
    } catch (error) {
      console.warn('Could not delete logo file:', error);
    }

    return this.prismaService.band.update({
      where: { id },
      data: { logoUrl: null },
    });
  }
}