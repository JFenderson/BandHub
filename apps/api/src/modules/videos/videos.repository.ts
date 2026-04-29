import { Injectable } from '@nestjs/common';
import { Prisma, Video, PrismaService, ReadReplicaService } from '@bandhub/database';
import {
  decodeCursor,
  buildCursorCondition,
  createCursorPaginatedResponse,
  CursorPaginatedResponse,
} from '../../common';

export interface VideoQueryDto {
  cursor?: string;
  bandId?: string;
  bandSlug?: string;
  conference?: string;  // Filter by band conference (e.g., SWAC, MEAC)
  bandType?: string;    // Filter by band type (HBCU, ALL_STAR, HIGH_SCHOOL)
  category?: string;  // Category enum value like 'FIFTH_QUARTER'
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

// Map category slug values to search keywords (used for legacy enum-style ?category= param)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '5th-quarter':        ['5th quarter', 'fifth quarter', 'post game', 'after the game'],
  'zero-quarter':       ['zero quarter', 'zero-quarter', '0 quarter', '0th quarter'],
  'field-playing':      ['field show', 'marching show', 'field playing', 'on-field', 'formation'],
  'stand-battle':       ['stand battle', 'battle of the bands', 'band battle', 'stands', 'botb', 'bita'],
  'halftime-show':      ['halftime', 'half time', 'half-time'],
  'parade':             ['parade', 'homecoming parade', 'mardi gras'],
  'practice':           ['practice', 'rehearsal', 'band camp', 'sectional', 'jamboree', 'scrimmage'],
  'concert':            ['concert', 'symphonic', 'spring show', 'indoor'],
  'entrance':           ['entrance', 'entering', 'arrival', 'pregame', 'pre-game', 'marching in'],
  'exit':               ['march out', 'marching out', 'exit march', 'band exit'],
  'percussion-feature': ['stick tape', 'drumline', 'drum feature', 'percussion feature', 'snare feature', 'tenor feature', 'quad feature'],
  'performance':        ['performance', 'performs', 'showcase', 'spotlight'],
  'high-school':        ['high school', 'hs band', 'jr high', 'middle school', 'prep school'],
  'other':              [],
};

/**
 * VideosRepository
 *
 * Handles all database operations for videos.
 * Uses read replica for read operations (findMany, findById, etc.)
 * Uses primary database for write operations (create, update, delete)
 */
@Injectable()
export class VideosRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readReplica: ReadReplicaService,
  ) {}

  async findMany(query: VideoQueryDto) {
    const {
      cursor,
      bandId,
      bandSlug,
      conference,
      bandType,
      category,
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
    } else if (conference) {
      where.band = { conference: conference };
    } else if (bandType) {
      where.band = { bandType: bandType as any };
    }

    // Handle category filtering by searching video titles for keywords
    if (category && CATEGORY_KEYWORDS[category]) {
      const keywords = CATEGORY_KEYWORDS[category];
      if (keywords.length > 0) {
        // Search for any of the keywords in the title (case-insensitive)
        where.OR = keywords.map(keyword => ({
          title: { contains: keyword, mode: 'insensitive' as const }
        }));
      }
    } else if (categoryId) {
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

    // Filter by year extracted from publishedAt
    if (eventYear) {
      const startOfYear = new Date(eventYear, 0, 1);
      const endOfYear = new Date(eventYear + 1, 0, 1);
      
      where.publishedAt = {
        gte: startOfYear,
        lt: endOfYear,
      };
    }
    
    if (eventName) {
      where.eventName = { contains: eventName, mode: 'insensitive' };
    }

    if (tags) {
      const tagList = tags.split(',').map((tag) => tag.trim());
      where.tags = { hasSome: tagList };
    }

    // Handle search - if we already have OR from category, combine them
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      const searchConditions = [
        { title: { contains: searchTerm, mode: 'insensitive' as const } },
        { description: { contains: searchTerm, mode: 'insensitive' as const } },
        { eventName: { contains: searchTerm, mode: 'insensitive' as const } },
        { band: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
      ];

      // If we already have OR conditions from category, we need to use AND with nested OR
      if (where.OR) {
        const categoryConditions = where.OR;
        delete where.OR;
        where.AND = [
          { OR: categoryConditions },
          { OR: searchConditions }
        ];
      } else {
        where.OR = searchConditions;
      }
    }

    const orderBy: Prisma.VideoOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const takeValue = Math.max(1, Math.min(Number(limit) || 20, 100));

    // Handle cursor-based pagination
    if (cursor) {
      return this.findManyWithCursor(where, cursor, takeValue, sortBy, sortOrder);
    }

    const skip = (page - 1) * limit;

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
      contentCreator: {
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

    // Use read replica for better read performance
    const [videos, total] = await this.readReplica.executeRead(async (client) => {
      return Promise.all([
        client.video.findMany({
          where,
          select,
          orderBy,
          ...(skip > 0 && { skip }),
          take: takeValue,
        }),
        client.video.count({ where }),
      ]);
    });

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
   * Find many videos using cursor-based pagination
   * More efficient for large datasets and infinite scroll
   */
  private async findManyWithCursor(
    baseWhere: Prisma.VideoWhereInput,
    cursor: string,
    limit: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Promise<CursorPaginatedResponse<any>> {
    const cursorData = decodeCursor(cursor);

    let where: Prisma.VideoWhereInput = { ...baseWhere };

    if (cursorData) {
      const cursorCondition = buildCursorCondition(cursorData, sortOrder);
      where = {
        AND: [baseWhere, cursorCondition],
      };
    }

    const orderBy: Prisma.VideoOrderByWithRelationInput = { [sortBy]: sortOrder };

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
      contentCreator: {
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

    // Fetch one extra item to determine if there are more results
    const videos = await this.readReplica.executeRead((client) =>
      client.video.findMany({
        where,
        select,
        take: limit + 1,
        orderBy: [orderBy, { id: sortOrder }], // Secondary sort by id for stability
      }),
    );

    // Create cursor-paginated response
    return createCursorPaginatedResponse(
      videos,
      limit,
      sortBy,
      (video) => {
        const value = video[sortBy as keyof typeof video];
        // Only valid sortBy fields return string, number, or Date types
        if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
          return value;
        }
        // Fallback to publishedAt if sortBy resolves to an invalid type (should not happen)
        return video.publishedAt;
      },
    );
  }

  /**
   * Find many videos with cursor pagination (public method)
   * Returns cursor-paginated response format
   */
  async findManyWithCursorPagination(
    query: Omit<VideoQueryDto, 'page'> & { cursor?: string },
  ): Promise<CursorPaginatedResponse<any>> {
    const {
      cursor,
      bandId,
      bandSlug,
      category,
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

    if (category && CATEGORY_KEYWORDS[category]) {
      const keywords = CATEGORY_KEYWORDS[category];
      if (keywords.length > 0) {
        where.OR = keywords.map(keyword => ({
          title: { contains: keyword, mode: 'insensitive' as const }
        }));
      }
    } else if (categoryId) {
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
      const startOfYear = new Date(eventYear, 0, 1);
      const endOfYear = new Date(eventYear + 1, 0, 1);
      where.publishedAt = {
        gte: startOfYear,
        lt: endOfYear,
      };
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
      const searchConditions = [
        { title: { contains: searchTerm, mode: 'insensitive' as const } },
        { description: { contains: searchTerm, mode: 'insensitive' as const } },
        { eventName: { contains: searchTerm, mode: 'insensitive' as const } },
        { band: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
      ];

      if (where.OR) {
        const categoryConditions = where.OR;
        delete where.OR;
        where.AND = [
          { OR: categoryConditions },
          { OR: searchConditions }
        ];
      } else {
        where.OR = searchConditions;
      }
    }

    const takeValue = Math.max(1, Math.min(Number(limit) || 20, 100));

    return this.findManyWithCursor(where, cursor || '', takeValue, sortBy, sortOrder);
  }

  /**
   * Full-text search using PostgreSQL tsvector - FIXED parameter handling
   */
  async fullTextSearch(
    searchQuery: string,
    filters: {
      bandId?: string;
      categoryId?: string;
      categorySlug?: string;
      conference?: string;
      includeHidden?: boolean;
    } = {},
    page: number = 1,
    limit: number = 20,
  ) {
    const { bandId, categoryId, categorySlug, conference, includeHidden } = filters;

    const conditions: string[] = [
      `(v.search_vector @@ plainto_tsquery('english', $1) OR v.title ILIKE '%' || $1 || '%')`,
    ];
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

    if (categorySlug && !categoryId) {
      conditions.push(`v.category_id = (SELECT id FROM categories WHERE slug = $${paramIndex})`);
      params.push(categorySlug);
      paramIndex++;
    }

    if (conference) {
      conditions.push(`EXISTS (SELECT 1 FROM bands b2 WHERE b2.id = v.band_id AND b2.conference = $${paramIndex})`);
      params.push(conference);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Add limit and offset to params array
    params.push(limit);
    params.push(offset);

    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;

    // Use read replica for full-text search queries
    const { videos, count } = await this.readReplica.executeRead(async (client) => {
      const videosResult = await client.$queryRawUnsafe<any[]>(`
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
          COALESCE(ts_rank(v.search_vector, plainto_tsquery('english', $1)), 0) as rank,
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
      const [{ count: countResult }] = await client.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count
        FROM videos v
        WHERE ${whereClause}
      `, ...countParams);

      return { videos: videosResult, count: countResult };
    });

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

  /**
   * Find video by ID
   * Uses read replica for better performance
   */
  async findById(id: string) {
    return this.readReplica.executeRead((client) =>
      client.video.findUnique({
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
          contentCreator: {
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
    );
  }

  /**
   * Find video by YouTube ID
   * Uses read replica for better performance
   */
  async findByYoutubeId(youtubeId: string) {
    return this.readReplica.executeRead((client) =>
      client.video.findUnique({
        where: { youtubeId },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          bandId: true,
          categoryId: true,
          isHidden: true,
        },
      }),
    );
  }

  async create(data: Prisma.VideoCreateInput) {
    return this.prisma.video.create({
      data,
      include: {
        band: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        opponentBand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async update(id: string, data: Prisma.VideoUpdateInput) {
    return this.prisma.video.update({
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
    return this.prisma.video.delete({ where: { id } });
  }

  /**
   * Find hidden videos
   * Uses read replica for better performance
   */
  async findHidden() {
    return this.readReplica.executeRead((client) =>
      client.video.findMany({
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
      }),
    );
  }

  /**
   * Get video statistics
   * Uses read replica for better performance
   */
  async getVideoStats() {
    return this.readReplica.executeRead(async (client) => {
      const [total, hidden, byCategory] = await Promise.all([
        client.video.count(),
        client.video.count({ where: { isHidden: true } }),
        client.video.groupBy({
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
    });
  }

  /**
   * Get popular videos by band
   * Uses read replica for better performance
   */
  async getPopularByBand(bandId: string, limit: number = 10) {
    return this.readReplica.executeRead((client) =>
      client.video.findMany({
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
      }),
    );
  }

  async batchUpdateViewCounts(updates: Array<{ id: string; viewCount: number; likeCount: number }>) {
    return this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.video.update({
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