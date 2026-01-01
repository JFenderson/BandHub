import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

export interface VideoQueryDto {
  bandId?: string;
  bandSlug?: string;
  categoryId?: string;
  categorySlug?: string;
  creatorId?: string;
  opponentBandId?: string;
  eventYear?: number;
  eventName?: string;
  search?: string;
  includeHidden?: boolean;
  tags?: string;
  sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

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

    const where: Prisma.VideoWhereInput = {};

    if (!includeHidden) {
      where.isHidden = false;
    }

    if (bandId) {
      where.bandId = bandId;
    } else if (bandSlug) {
      where.band = { slug: bandSlug };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (opponentBandId) {
      where.opponentBandId = opponentBandId;
    }

    if (eventYear) {
      where.eventYear = eventYear;
    }
    if (eventName) {
      where.eventName = { contains: eventName, mode: 'insensitive' };
    }

    if (tags) {
      const tagList = tags.split(',').map((tag) => tag.trim());
      where.tags = { hasSome: tagList };
    }

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { eventName: { contains: searchTerm, mode: 'insensitive' } },
        { band: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.VideoOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const skip = (page - 1) * limit;
    const takeValue = Math.max(1, Math.min(Number(limit) || 20, 100));

    const select = {
      id: true,
      youtubeId: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      duration: true,
      publishedAt: true,
      viewCount: true,
      likeCount: true,
      eventName: true,
      eventYear: true,
      tags: true,
      qualityScore: true,
      isHidden: true,
      createdAt: true,
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
    };

    const [videos, total] = await Promise.all([
      this.db.video.findMany({
        where,
        select,
        orderBy,
        ...(skip > 0 && { skip }),
        take: takeValue,
      }),
      this.db.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit: takeValue,
        totalPages: Math.ceil(total / takeValue),
      },
    };
  }

  /**
   * Full-text search using PostgreSQL tsvector - FIXED parameter handling
   */
  async fullTextSearch(
    searchQuery: string,
    filters: {
      bandId?: string;
      categoryId?: string;
      includeHidden?: boolean;
    } = {},
    page: number = 1,
    limit: number = 20,
  ) {
    const { bandId, categoryId, includeHidden } = filters;
    
    const conditions: string[] = ["v.search_vector @@ plainto_tsquery('english', $1)"];
    const params: any[] = [searchQuery];
    let paramIndex = 2;

    if (!includeHidden) {
      conditions.push('v.is_hidden = false');
    }

    if (bandId) {
      conditions.push(`v.band_id = $${paramIndex}`);
      params.push(bandId);
      paramIndex++;
    }

    if (categoryId) {
      conditions.push(`v.category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Add limit and offset to params array
    params.push(limit);
    params.push(offset);

    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;

    const videos = await this.db.$queryRawUnsafe<any[]>(`
      SELECT 
        v.id,
        v.youtube_id as "youtubeId",
        v.title,
        v.description,
        v.thumbnail_url as "thumbnailUrl",
        v.duration,
        v.published_at as "publishedAt",
        v.view_count as "viewCount",
        v.like_count as "likeCount",
        v.event_name as "eventName",
        v.event_year as "eventYear",
        v.tags,
        v.quality_score as "qualityScore",
        v.is_hidden as "isHidden",
        v.created_at as "createdAt",
        ts_rank(v.search_vector, plainto_tsquery('english', $1)) as rank,
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
          'schoolName', b.school_name,
          'logoUrl', b.logo_url
        ) as band,
        CASE 
          WHEN c.id IS NOT NULL THEN jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug
          )
          ELSE NULL
        END as category,
        NULL as "opponentBand",
        NULL as creator
      FROM videos v
      INNER JOIN bands b ON v.band_id = b.id
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE ${whereClause}
      ORDER BY rank DESC, v.published_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, ...params);

    // Count query - use same params except limit/offset
    const countParams = params.slice(0, -2);
    const [{ count }] = await this.db.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count
      FROM videos v
      WHERE ${whereClause}
    `, ...countParams);

    return {
      data: videos,
      meta: {
        total: Number(count),
        page,
        limit,
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }

  async findById(id: string) {
    return this.db.video.findUnique({
      where: { id },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        duration: true,
        publishedAt: true,
        viewCount: true,
        likeCount: true,
        eventName: true,
        eventYear: true,
        tags: true,
        isHidden: true,
        hideReason: true,
        qualityScore: true,
        createdAt: true,
        updatedAt: true,
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
            state: true,
            city: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
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
      select: {
        id: true,
        youtubeId: true,
        title: true,
        bandId: true,
        categoryId: true,
        isHidden: true,
      },
    });
  }

  async create(data: Prisma.VideoCreateInput) {
    return this.db.video.create({
      data,
      include: {
        band: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        opponentBand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async update(id: string, data: Prisma.VideoUpdateInput) {
    return this.db.video.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: {
        band: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        opponentBand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async delete(id: string) {
    return this.db.video.delete({ where: { id } });
  }

  async findHidden() {
    return this.db.video.findMany({
      where: { isHidden: true },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        thumbnailUrl: true,
        hideReason: true,
        createdAt: true,
        band: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVideoStats() {
    const [total, hidden, byCategory] = await Promise.all([
      this.db.video.count(),
      this.db.video.count({ where: { isHidden: true } }),
      this.db.video.groupBy({
        by: ['categoryId'],
        _count: true,
        where: { isHidden: false, categoryId: { not: null } },
      }),
    ]);

    return {
      total,
      hidden,
      visible: total - hidden,
      byCategory,
    };
  }

  async getPopularByBand(bandId: string, limit: number = 10) {
    return this.db.video.findMany({
      where: { bandId, isHidden: false },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        publishedAt: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });
  }

  async batchUpdateViewCounts(updates: Array<{ id: string; viewCount: number; likeCount: number }>) {
    return this.db.$transaction(
      updates.map((update) =>
        this.db.video.update({
          where: { id: update.id },
          data: {
            viewCount: update.viewCount,
            likeCount: update.likeCount,
            updatedAt: new Date(),
          },
          select: { id: true },
        })
      )
    );
  }
}