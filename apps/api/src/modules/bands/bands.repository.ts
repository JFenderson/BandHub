import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BandQueryDto } from './dto';
import { Prisma } from '@prisma/client';

/**
 * BandsRepository
 * 
 * Handles all database operations for bands
 */
@Injectable()
export class BandsRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find many bands with filters
   */
  async findMany(query: BandQueryDto) {
    const { search, state, page = 1, limit = 20 } = query;

    const where: Prisma.BandWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { schoolName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (state) {
      where.state = state;
    }

    const [bands, total] = await Promise.all([
      this.db.band.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
      this.db.band.count({ where }),
    ]);

    return {
      data: bands,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find band by ID
   */
  async findById(id: string) {
    return this.db.band.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  /**
   * Find band by slug
   */
  async findBySlug(slug: string) {
    return this.db.band.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  /**
   * Create new band
   */
  async create(data: Prisma.BandCreateInput) {
    return this.db.band.create({
      data,
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  /**
   * Update band
   */
  async update(id: string, data: Prisma.BandUpdateInput) {
    return this.db.band.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  /**
   * Delete band
   */
  async delete(id: string) {
    return this.db.band.delete({
      where: { id },
    });
  }

  /**
   * Get band statistics by ID
   * Returns video count and other stats
   */
  async getBandStats(id: string) {
    const band = await this.db.band.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!band) {
      return null;
    }

    return {
      id: band.id,
      name: band.name,
      videoCount: band._count.videos,
      slug: band.slug,
      state: band.state,
      city: band.city,
    };
  }

  /**
   * Get popular bands
   * Returns bands ordered by video count
   */
  async getPopularBands(limit: number) {
    return this.db.band.findMany({
      take: limit,
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
  }

  /**
   * Search bands
   * Full-text search across name, school, city, state
   */
  async search(query: string) {
    return this.db.band.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { schoolName: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { state: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }
}