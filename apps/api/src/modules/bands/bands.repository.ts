import { Injectable } from '@nestjs/common';
import { PrismaService, ReadReplicaService } from '@bandhub/database';
import { BandQueryDto } from './dto';
import { Prisma } from '@prisma/client';

/**
 * BandsRepository
 *
 * Handles all database operations for bands.
 * Uses read replica for read operations (findMany, findById, etc.)
 * Uses primary database for write operations (create, update, delete)
 */
@Injectable()
export class BandsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readReplica: ReadReplicaService,
  ) {}

  /**
   * Find many bands with filters
   * Uses read replica for better performance on read-heavy operations
   */
  async findMany(query: BandQueryDto) {
    const { search, state, page = 1, limit = 20, bandType, isFeatured } = query;

    const where: Prisma.BandWhereInput = {};

    if (bandType) {
      where.bandType = bandType;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

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

    // Use read replica for better read performance
    const [bands, total] = await this.readReplica.executeRead(async (client) => {
      return Promise.all([
        client.band.findMany({
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
        client.band.count({ where }),
      ]);
    });

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
   * Uses read replica for better performance
   */
  async findById(id: string) {
    return this.readReplica.executeRead((client) =>
      client.band.findUnique({
        where: { id },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
    );
  }

  /**
   * Find band by slug
   * Uses read replica for better performance
   */
  async findBySlug(slug: string) {
    return this.readReplica.executeRead((client) =>
      client.band.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
    );
  }

  /**
   * Create new band
   */
  async create(data: Prisma.BandCreateInput) {
    return this.prisma.band.create({
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
    return this.prisma.band.update({
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
    return this.prisma.band.delete({
      where: { id },
    });
  }

  /**
   * Get band statistics by ID
   * Returns video count and other stats
   * Uses read replica for better performance
   */
  async getBandStats(id: string) {
    const band = await this.readReplica.executeRead((client) =>
      client.band.findUnique({
        where: { id },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
    );

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
   * Uses read replica for better performance
   */
  async getPopularBands(limit: number) {
    return this.readReplica.executeRead((client) =>
      client.band.findMany({
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
      }),
    );
  }

  /**
   * Search bands
   * Full-text search across name, school, city, state
   * Uses read replica for better performance
   */
  async search(query: string) {
    return this.readReplica.executeRead((client) =>
      client.band.findMany({
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
      }),
    );
  }
}