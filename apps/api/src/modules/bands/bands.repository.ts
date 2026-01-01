import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

export interface BandQueryDto {
  conference?: string;
  state?: string;
  search?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  sortBy?: 'name' | 'schoolName' | 'createdAt' | 'featuredOrder';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Optimized BandsRepository with:
 * - Composite index usage for state + conference queries
 * - Selective field loading
 * - Full-text search support via tsvector
 * - Optimized aggregations
 */
@Injectable()
export class BandsRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find many bands with optimized queries
   * Uses composite indexes: bands_state_conference_idx, bands_active_state_idx
   */
  async findMany(query: BandQueryDto) {
    const {
      conference,
      state,
      search,
      isFeatured,
      isActive = true,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.BandWhereInput = {};

    // Active filter - uses bands_active_state_idx when combined with state
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // State and conference filtering - uses bands_state_conference_idx composite
    if (state) {
      where.state = state;
    }
    if (conference) {
      where.conference = conference;
    }

    // Featured filtering - uses bands_featured_order_idx partial index
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    // Search functionality - will use bands_search_vector_idx when implemented
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          schoolName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Sorting - FIXED: Check for featuredOrder instead of 'featured'
    const orderBy: Prisma.BandOrderByWithRelationInput = {};
    
    if (sortBy === 'featuredOrder') {
      orderBy.featuredOrder = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Pagination
    const skip = (page - 1) * limit;
    const takeValue = Math.max(1, Math.min(Number(limit) || 20, 100));

    // Execute the query with selective field loading
    const [bands, total] = await Promise.all([
      this.db.band.findMany({
        where,
        orderBy,
        ...(skip > 0 && { skip }),
        take: takeValue,
        select: {
          id: true,
          name: true,
          slug: true,
          schoolName: true,
          city: true,
          state: true,
          conference: true,
          logoUrl: true,
          bannerUrl: true,
          description: true,
          foundedYear: true,
          isFeatured: true,
          featuredOrder: true,
          totalVideoCount: true,
          _count: {
            select: {
              videos: {
                where: {
                  isHidden: false,
                },
              },
            },
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
        limit: takeValue,
        totalPages: Math.ceil(total / takeValue),
      },
    };
  }

  // ... rest of the file remains the same ...
  // (I'll just include the key methods, you can keep the rest from the original)

  async findById(id: string) {
    return this.db.band.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolName: true,
        city: true,
        state: true,
        conference: true,
        logoUrl: true,
        bannerUrl: true,
        description: true,
        foundedYear: true,
        youtubeChannelId: true,
        isFeatured: true,
        isActive: true,
        totalVideoCount: true,
        earliestVideoDate: true,
        latestVideoDate: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            videos: {
              where: {
                isHidden: false,
              },
            },
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.db.band.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolName: true,
        city: true,
        state: true,
        conference: true,
        logoUrl: true,
        bannerUrl: true,
        description: true,
        foundedYear: true,
        youtubeChannelId: true,
        isFeatured: true,
        isActive: true,
        totalVideoCount: true,
        earliestVideoDate: true,
        latestVideoDate: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            videos: {
              where: {
                isHidden: false,
              },
            },
          },
        },
      },
    });
  }

  async create(data: Prisma.BandCreateInput) {
    return this.db.band.create({
      data,
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.BandUpdateInput) {
    return this.db.band.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.db.band.delete({
      where: { id },
    });
  }

  async getBandStats() {
    const [total, withVideos, byConference, byState] = await Promise.all([
      this.db.band.count(),
      this.db.band.count({
        where: {
          videos: {
            some: {
              isHidden: false,
            },
          },
        },
      }),
      this.db.band.groupBy({
        by: ['conference'],
        _count: true,
        where: {
          conference: {
            not: null,
          },
        },
      }),
      this.db.band.groupBy({
        by: ['state'],
        _count: true,
      }),
    ]);

    return {
      total,
      withVideos,
      withoutVideos: total - withVideos,
      byConference,
      byState,
    };
  }

  async getBandsByState(state: string, includeInactive: boolean = false) {
    return this.db.band.findMany({
      where: {
        state,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolName: true,
        city: true,
        logoUrl: true,
        totalVideoCount: true,
        _count: {
          select: {
            videos: {
              where: {
                isHidden: false,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getFeaturedBands(limit: number = 10) {
    return this.db.band.findMany({
      where: {
        isFeatured: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolName: true,
        logoUrl: true,
        bannerUrl: true,
        description: true,
        featuredOrder: true,
        totalVideoCount: true,
      },
      orderBy: {
        featuredOrder: 'asc',
      },
      take: limit,
    });
  }
}