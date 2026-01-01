import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@prisma/client';

export interface SearchFilters {
  query?: string;
  bandIds?: string[];
  categoryIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  durationMin?: number;
  durationMax?: number;
  viewCountMin?: number;
  viewCountMax?: number;
  hasOpponent?: boolean;
  sortBy?: 'relevance' | 'publishedAt' | 'viewCount' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date;
  viewCount: number;
  youtubeId: string;
  rank?: number; // Relevance rank from full-text search
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  opponentBand?: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Optimized SearchService with:
 * - PostgreSQL full-text search using tsvector and GIN indexes
 * - Relevance ranking with ts_rank
 * - Optimized filter combinations using composite indexes
 * - Query result caching in VideosService
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Advanced multi-faceted search with PostgreSQL full-text search
   * Uses videos_search_vector_idx GIN index for optimal performance
   */
  async search(filters: SearchFilters) {
    const {
      query,
      bandIds,
      categoryIds,
      dateFrom,
      dateTo,
      durationMin,
      durationMax,
      viewCountMin,
      viewCountMax,
      hasOpponent,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    // If we have a search query, use optimized full-text search
    if (query && query.trim().length > 0) {
      return this.fullTextSearch(filters);
    }

    // Otherwise, use standard filtered search
    return this.filteredSearch(filters);
  }

  /**
   * Full-text search using PostgreSQL tsvector for optimal performance
   */
  private async fullTextSearch(filters: SearchFilters) {
    const {
      query,
      bandIds,
      categoryIds,
      dateFrom,
      dateTo,
      durationMin,
      durationMax,
      viewCountMin,
      viewCountMax,
      hasOpponent,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    const searchQuery = query!.trim();
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ["v.search_vector @@ plainto_tsquery('english', $1)", 'v.is_hidden = false'];
    const params: any[] = [searchQuery];
    let paramIndex = 2;

    // Band filter - uses videos_band_hidden_published_idx
    if (bandIds && bandIds.length > 0) {
      conditions.push(`v.band_id = ANY($${paramIndex}::text[])`);
      params.push(bandIds);
      paramIndex++;
    }

    // Category filter - uses videos_category_hidden_published_idx
    if (categoryIds && categoryIds.length > 0) {
      conditions.push(`v.category_id = ANY($${paramIndex}::text[])`);
      params.push(categoryIds);
      paramIndex++;
    }

    // Date range filter - uses videos_hidden_published_idx
    if (dateFrom) {
      conditions.push(`v.published_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`v.published_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    // Duration filter - uses videos_duration_idx
    if (durationMin !== undefined) {
      conditions.push(`v.duration >= $${paramIndex}`);
      params.push(durationMin);
      paramIndex++;
    }
    if (durationMax !== undefined) {
      conditions.push(`v.duration <= $${paramIndex}`);
      params.push(durationMax);
      paramIndex++;
    }

    // View count filter - uses videos_viewcount_idx
    if (viewCountMin !== undefined) {
      conditions.push(`v.view_count >= $${paramIndex}`);
      params.push(viewCountMin);
      paramIndex++;
    }
    if (viewCountMax !== undefined) {
      conditions.push(`v.view_count <= $${paramIndex}`);
      params.push(viewCountMax);
      paramIndex++;
    }

    // Opponent filter - uses videos_opponent_hidden_idx
    if (hasOpponent !== undefined) {
      if (hasOpponent) {
        conditions.push('v.opponent_band_id IS NOT NULL');
      } else {
        conditions.push('v.opponent_band_id IS NULL');
      }
    }

    const whereClause = conditions.join(' AND ');

    // Build ORDER BY clause
    let orderByClause: string;
    if (sortBy === 'relevance') {
      orderByClause = 'rank DESC, v.published_at DESC';
    } else if (sortBy === 'publishedAt') {
      orderByClause = `v.published_at ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'viewCount') {
      orderByClause = `v.view_count ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = `v.title ${sortOrder.toUpperCase()}`;
    }

    // Execute optimized query with ranking
    const videos = await this.prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        v.id,
        v.youtube_id as "youtubeId",
        v.title,
        v.description,
        v.thumbnail_url as "thumbnailUrl",
        v.duration,
        v.published_at as "publishedAt",
        v.view_count as "viewCount",
        ts_rank(v.search_vector, plainto_tsquery('english', $1)) as rank,
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
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
        CASE 
          WHEN ob.id IS NOT NULL THEN jsonb_build_object(
            'id', ob.id,
            'name', ob.name,
            'slug', ob.slug
          )
          ELSE NULL
        END as "opponentBand"
      FROM videos v
      INNER JOIN bands b ON v.band_id = b.id
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN bands ob ON v.opponent_band_id = ob.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, ...params, limit, offset);

    // Get total count
    const [{ count }] = await this.prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count
      FROM videos v
      WHERE ${whereClause}
    `, ...params.slice(0, paramIndex - 2)); // Remove limit and offset

    this.logger.debug(`Full-text search for "${searchQuery}" returned ${videos.length} results`);

    return {
      data: videos,
      meta: {
        total: Number(count),
        page,
        limit,
        totalPages: Math.ceil(Number(count) / limit),
        query: searchQuery,
      },
    };
  }

  /**
   * Standard filtered search (without text search)
   * Uses appropriate composite indexes based on filters
   */
  private async filteredSearch(filters: SearchFilters) {
    const {
      bandIds,
      categoryIds,
      dateFrom,
      dateTo,
      durationMin,
      durationMax,
      viewCountMin,
      viewCountMax,
      hasOpponent,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.VideoWhereInput = {
      isHidden: false,
    };

    // Band filter
    if (bandIds && bandIds.length > 0) {
      where.bandId = { in: bandIds };
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.publishedAt = {};
      if (dateFrom) where.publishedAt.gte = dateFrom;
      if (dateTo) where.publishedAt.lte = dateTo;
    }

    // Duration filter
    if (durationMin !== undefined || durationMax !== undefined) {
      where.duration = {};
      if (durationMin !== undefined) where.duration.gte = durationMin;
      if (durationMax !== undefined) where.duration.lte = durationMax;
    }

    // View count filter
    if (viewCountMin !== undefined || viewCountMax !== undefined) {
      where.viewCount = {};
      if (viewCountMin !== undefined) where.viewCount.gte = viewCountMin;
      if (viewCountMax !== undefined) where.viewCount.lte = viewCountMax;
    }

    // Opponent filter
    if (hasOpponent !== undefined) {
      if (hasOpponent) {
        where.opponentBandId = { not: null };
      } else {
        where.opponentBandId = null;
      }
    }

    // Determine sort order
    const orderBy: Prisma.VideoOrderByWithRelationInput[] = [];
    
    if (sortBy === 'relevance' || sortBy === 'publishedAt') {
      orderBy.push({ publishedAt: sortOrder });
    } else if (sortBy === 'viewCount') {
      orderBy.push({ viewCount: sortOrder });
    } else {
      orderBy.push({ title: sortOrder });
    }

    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          youtubeId: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          duration: true,
          publishedAt: true,
          viewCount: true,
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
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
            },
          },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos as SearchResult[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: null,
      },
    };
  }

  /**
   * Get search suggestions using tsvector
   * Uses bands_search_vector_idx for band name suggestions
   */
  async getSuggestions(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      return { suggestions: [] };
    }

    const searchTerm = query.trim();

    // Get band name suggestions using full-text search
    const bandSuggestions = await this.prisma.$queryRawUnsafe<Array<{ name: string; slug: string }>>(
      `
      SELECT name, slug
      FROM bands
      WHERE search_vector @@ plainto_tsquery('english', $1)
        AND is_active = true
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
      LIMIT 5
      `,
      searchTerm
    );

    // Get video title suggestions
    const videoSuggestions = await this.prisma.video.findMany({
      where: {
        title: { contains: searchTerm, mode: 'insensitive' },
        isHidden: false,
      },
      select: {
        title: true,
        id: true,
      },
      take: 5,
      distinct: ['title'],
    });

    // Get event name suggestions
    const eventSuggestions = await this.prisma.video.findMany({
      where: {
        eventName: { contains: searchTerm, mode: 'insensitive' },
        isHidden: false,
      },
      select: {
        eventName: true,
      },
      take: 5,
      distinct: ['eventName'],
    });

    const suggestions = [
      ...bandSuggestions.map((b) => ({
        type: 'band' as const,
        text: b.name,
        slug: b.slug,
      })),
      ...videoSuggestions.map((v) => ({
        type: 'video' as const,
        text: v.title,
        id: v.id,
      })),
      ...eventSuggestions
        .filter((e) => e.eventName)
        .map((e) => ({
          type: 'event' as const,
          text: e.eventName!,
        })),
    ].slice(0, limit);

    return { suggestions };
  }

  /**
   * Get popular searches (unchanged, already optimized)
   */
  async getPopularSearches(limit: number = 10) {
    const popularSearches = await this.prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
        resultsCount: { gt: 0 },
      },
    });

    return {
      popularSearches: popularSearches.map((s) => ({
        query: s.query,
        count: s._count.query,
      })),
    };
  }

  /**
   * Log a search for analytics
   */
  async logSearch(
    query: string,
    resultsCount: number,
    filters?: Record<string, unknown>,
    userId?: string,
    sessionId?: string,
  ) {
    await this.prisma.searchLog.create({
      data: {
        query: query.toLowerCase().trim(),
        resultsCount,
        filters: filters ? (filters as Prisma.InputJsonValue) : undefined,
        userId,
        sessionId,
      },
    });
  }

  /**
   * Get bands for filter options (optimized with selective fields)
   */
  async getBandsForFilter() {
    return this.prisma.band.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        _count: { select: { videos: { where: { isHidden: false } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get categories for filter options (optimized)
   */
  async getCategoriesForFilter() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { videos: { where: { isHidden: false } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}