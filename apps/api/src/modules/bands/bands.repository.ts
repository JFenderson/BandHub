import { Injectable } from '@nestjs/common';
import { PrismaService, ReadReplicaService } from '@bandhub/database';
import { BandQueryDto } from './dto';
import { Prisma } from '@prisma/client';
import {
  decodeCursor,
  buildCursorCondition,
  createCursorPaginatedResponse,
  CursorPaginatedResponse,
} from '../../common';

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
   * Supports both offset-based and cursor-based pagination
   */
  async findMany(query: BandQueryDto) {
    const {
      search,
      state,
      page = 1,
      limit = 20,
      bandType,
      isFeatured,
      cursor,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

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

    // Handle cursor-based pagination
    if (cursor) {
      return this.findManyWithCursor(where, cursor, limit, sortBy, sortOrder);
    }

    // Default to offset-based pagination
    const orderBy: Prisma.BandOrderByWithRelationInput = { [sortBy]: sortOrder };

    // Use read replica for better read performance
    const [bands, total] = await this.readReplica.executeRead(async (client) => {
      return Promise.all([
        client.band.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
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
   * Find many bands using cursor-based pagination
   * More efficient for large datasets and infinite scroll
   */
  private async findManyWithCursor(
    baseWhere: Prisma.BandWhereInput,
    cursor: string,
    limit: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Promise<CursorPaginatedResponse<any>> {
    const cursorData = decodeCursor(cursor);

    let where: Prisma.BandWhereInput = { ...baseWhere };

    if (cursorData) {
      const cursorCondition = buildCursorCondition(cursorData, sortOrder);
      where = {
        AND: [baseWhere, cursorCondition],
      };
    }

    const orderBy: Prisma.BandOrderByWithRelationInput = { [sortBy]: sortOrder };

    // Fetch one extra item to determine if there are more results
    const bands = await this.readReplica.executeRead((client) =>
      client.band.findMany({
        where,
        take: limit + 1,
        orderBy: [orderBy, { id: sortOrder }], // Secondary sort by id for stability
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
    );

    // Create cursor-paginated response
    return createCursorPaginatedResponse(
      bands,
      limit,
      sortBy,
      (band) => {
        const value = band[sortBy as keyof typeof band];
        // Only name, schoolName, and createdAt are valid sortBy fields
        if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
          return value;
        }
        // Fallback to name if sortBy resolves to an invalid type (should not happen)
        return band.name;
      },
    );
  }

  /**
   * Find many bands with cursor pagination (public method)
   * Returns cursor-paginated response format
   */
  async findManyWithCursorPagination(
    query: Omit<BandQueryDto, 'page'> & { cursor?: string },
  ): Promise<CursorPaginatedResponse<any>> {
    const {
      search,
      state,
      limit = 20,
      bandType,
      isFeatured,
      cursor,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

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

    return this.findManyWithCursor(where, cursor || '', limit, sortBy, sortOrder);
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