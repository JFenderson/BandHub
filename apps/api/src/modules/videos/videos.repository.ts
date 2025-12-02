import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { VideoQueryDto } from './dto';

@Injectable()
export class VideosRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(query: VideoQueryDto) {
    const {
      bandId,
      bandSlug,
      categoryId,
      categorySlug,
      creatorId,
      opponentBandId,
      eventYear,
      eventName,
      search,
      includeHidden,
      tags,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    // Build the where clause
    const where: Prisma.VideoWhereInput = {};

    // Hide videos by default unless explicitly requested
    if (!includeHidden) {
      where.isHidden = false;
    }

    // Band filtering (by ID or slug)
    if (bandId) {
      where.bandId = bandId;
    } else if (bandSlug) {
      where.band = {
        slug: bandSlug,
      };
    }

    // Category filtering (by ID or slug)
    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categorySlug) {
      where.category = {
        slug: categorySlug,
      };
    }

    // Creator filtering
    if (creatorId) {
      where.creatorId = creatorId;
    }

    // Opponent band filtering
    if (opponentBandId) {
      where.opponentBandId = opponentBandId;
    }

    // Event filtering
    if (eventYear) {
      where.eventYear = eventYear;
    }
    if (eventName) {
      where.eventName = {
        contains: eventName,
        mode: 'insensitive',
      };
    }

    // Tags filtering
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim());
      where.tags = {
        hasSome: tagList,
      };
    }

    // Full-text search
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          tags: {
            hasSome: search.split(' ').map(term => term.trim()),
          },
        },
        {
          band: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          creator: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Sorting
    const orderBy: Prisma.VideoOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Pagination
    const skip = (page - 1) * limit;

    // Execute the query with relationships
    const [videos, total] = await Promise.all([
      this.db.video.findMany({
         where,
    orderBy,
    skip,
        take: limit,
        include: {
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              schoolName: true,
              logoUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          opponentBand: {
            select: {
              id: true,
              name: true,
              slug: true,
              schoolName: true,
              logoUrl: true,
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
              qualityScore: true,
            },
          },
        },
      }),
      this.db.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return this.db.video.findUnique({
      where: { id },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        opponentBand: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
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
            qualityScore: true,
          },
        },
      },
    });
  }

  async findByYoutubeId(youtubeId: string) {
    return this.db.video.findUnique({
      where: { youtubeId },
    });
  }

  // Change the parameter type to accept the proper Prisma input
  async create(data: Prisma.VideoCreateInput) {
    return this.db.video.create({
      data,
      include: {
        band: true,
        category: true,
        opponentBand: true,
      },
    });
  }

  async update(id: string, data: Prisma.VideoUpdateInput) {
    return this.db.video.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        band: true,
        category: true,
        opponentBand: true,
      },
    });
  }

  async delete(id: string) {
    return this.db.video.delete({
      where: { id },
    });
  }

  // Admin-specific queries
  async findHidden() {
    return this.db.video.findMany({
      where: { isHidden: true },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async getVideoStats() {
    const [total, hidden, byCategory] = await Promise.all([
      this.db.video.count(),
      this.db.video.count({ where: { isHidden: true } }),
      this.db.video.groupBy({
        by: ['categoryId'],
        _count: true,
        where: { isHidden: false },
      }),
    ]);

    return {
      total,
      hidden,
      visible: total - hidden,
      byCategory,
    };
  }
}