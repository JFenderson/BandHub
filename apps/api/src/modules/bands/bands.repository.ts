import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service'; // Change from PrismaService
import { BandQueryDto } from './dto';

@Injectable()
export class BandsRepository {
  constructor(private readonly db: DatabaseService) {} // Change from PrismaService

  async findMany(query: BandQueryDto) {
    const {
      conference,
      state,
      search,
      isFeatured,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = query;

    // Build the where clause
    const where: Prisma.BandWhereInput = {};

    // Conference filtering
    if (conference) {
      where.conference = conference;
    }

    // State filtering
    if (state) {
      where.state = state;
    }

    // Featured filtering
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    // Search functionality
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

    // Sorting
    const orderBy: Prisma.BandOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Pagination
    const skip = (page - 1) * limit;

    // Execute the query
    const [bands, total] = await Promise.all([
      this.db.band.findMany({
        where,
        orderBy,
        ...(skip > 0 && { skip }),
        take: limit,
        include: {
          _count: {
            select: {
              videos: {
                where: {
                  isHidden: false, // Only count visible videos
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
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return this.db.band.findUnique({
      where: { id },
      include: {
        videos: {
          where: {
            isHidden: false,
          },
          orderBy: {
            publishedAt: 'desc',
          },
          take: 10, // Latest 10 videos
          include: {
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
                logoUrl: true,
                thumbnailUrl: true,
                isVerified: true,
                isFeatured: true,
              },
            },
          },
        },
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
      include: {
        videos: {
          where: {
            isHidden: false,
          },
          orderBy: {
            publishedAt: 'desc',
          },
          take: 10,
          include: {
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
                logoUrl: true,
                thumbnailUrl: true,
                isVerified: true,
                isFeatured: true,
              },
            },
          },
        },
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
    const [total, withVideos, byConference] = await Promise.all([
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
    ]);

    return {
      total,
      withVideos,
      withoutVideos: total - withVideos,
      byConference,
    };
  }
}
