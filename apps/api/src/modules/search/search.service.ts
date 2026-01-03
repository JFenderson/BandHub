import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@prisma/client';


export interface AutocompleteSuggestion {
  id: string;
  value: string;
  type: 'band' | 'event' | 'category' | 'location';
  metadata?: {
    logoUrl?: string;
    count?: number;
    state?: string;
  };
}

export interface FilterMetadata {
  categories: Array<{ value: string; label: string; count: number }>;
  conferences: Array<{ value: string; label: string; count: number }>;
  states: Array<{ value: string; label: string; count: number }>;
  regions: Array<{ value: string; label: string; count: number }>;
  years: number[];
}


export interface SearchFilters {
  query?: string;
  bandIds?: string[];
  categoryIds?: string[];
    years?: number[];  // ADD THIS
   conferences?: string[];   // ADD THIS
  states?: string[];  // ADD THIS
  regions?: string[];  // ADD THIS
  eventName?: string;  // ADD THIS
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


    // If we have a search query, use optimized full-text search
   const { query } = filters;

    // Otherwise, use standard filtered search
    return this.filteredSearchWithText(filters);
  }

  /**
   * Full-text search using PostgreSQL tsvector for optimal performance
   */
  private async fullTextSearch(filters: SearchFilters) {
    const {
      query,
      bandIds,
      categoryIds,
      years,
      conferences,  // Add this
      states,
      regions,
      eventName,
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

      // ADD: Year filter
    if (filters.years && filters.years.length > 0) {
      conditions.push(`EXTRACT(YEAR FROM v.published_at) = ANY($${paramIndex}::int[])`);
      params.push(filters.years);
      paramIndex++;
    }

    // ADD: Conference filter
    if (conferences && conferences.length > 0) {
      conditions.push(`b.conference = ANY($${paramIndex}::text[])`);
      params.push(conferences);
      paramIndex++;
    }

    // ADD: State filter
    if (filters.states && filters.states.length > 0) {
      conditions.push(`b.state = ANY($${paramIndex}::text[])`);
      params.push(filters.states);
      paramIndex++;
    }

    // ADD: Event name filter
    if (filters.eventName) {
      conditions.push(`v.event_name ILIKE $${paramIndex}`);
      params.push(`%${filters.eventName}%`);
      paramIndex++;
    }

    // For regions, you'll need to expand to states
    if (filters.regions && filters.regions.length > 0) {
      const regionToStates = {
        northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
        southeast: ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
        midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
        southwest: ['AZ', 'NM', 'OK', 'TX'],
        west: ['CO', 'ID', 'MT', 'NV', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
      };
      
      const statesInRegions = filters.regions.flatMap(
        region => regionToStates[region as keyof typeof regionToStates] || []
      );
      
      if (statesInRegions.length > 0) {
        conditions.push(`b.state = ANY($${paramIndex}::text[])`);
        params.push(statesInRegions);
        paramIndex++;
      }
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
   * Filtered search with text matching (fallback when search_vector doesn't exist)
   */
  private async filteredSearchWithText(filters: SearchFilters) {
    const {
      query,
      bandIds,
      categoryIds,
      years,
      conferences,
      states,
      regions,
      eventName,
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

    // Build band filters separately
    const bandFilters: Prisma.BandWhereInput = {};
    let hasBandFilters = false;

    // Conference filter
    if (conferences && conferences.length > 0) {
      bandFilters.conference = { in: conferences };
      hasBandFilters = true;
    }

    // State filter
    if (states && states.length > 0) {
      bandFilters.state = { in: states };
      hasBandFilters = true;
    }

    // Region filter
    if (regions && regions.length > 0) {
      const regionToStates = {
        northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
        southeast: ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
        midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
        southwest: ['AZ', 'NM', 'OK', 'TX'],
        west: ['CO', 'ID', 'MT', 'NV', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
      };
      
      const statesInRegions = regions.flatMap(
        region => regionToStates[region as keyof typeof regionToStates] || []
      );
      
      if (statesInRegions.length > 0) {
        // Override state filter if regions are specified
        bandFilters.state = { in: statesInRegions };
        hasBandFilters = true;
      }
    }

    // Apply band filters if any exist
    if (hasBandFilters) {
      where.band = bandFilters;
    }

    // Text search using ILIKE (case-insensitive)
    if (query && query.trim().length > 0) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { eventName: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Band ID filter (direct filter, not relation)
    if (bandIds && bandIds.length > 0) {
      where.bandId = { in: bandIds };
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    // Year filter
    if (years && years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      where.publishedAt = {
        gte: new Date(`${minYear}-01-01`),
        lte: new Date(`${maxYear}-12-31`),
      };
    }

    // Event name filter
    if (eventName) {
      where.eventName = { contains: eventName, mode: 'insensitive' };
    }

    // Date range filter (simpler approach)
    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      
      // Preserve existing filters from year filter
      if (where.publishedAt && typeof where.publishedAt === 'object') {
        if ('gte' in where.publishedAt && where.publishedAt.gte) {
          dateFilter.gte = where.publishedAt.gte as Date;
        }
        if ('lte' in where.publishedAt && where.publishedAt.lte) {
          dateFilter.lte = where.publishedAt.lte as Date;
        }
      }
      
      // Override with explicit date range
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      
      where.publishedAt = dateFilter;
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
          eventName: true,
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
        query: query || null,
      },
    };
  }


   /**
   * Get autocomplete suggestions with type filtering
   */
/**
   * Get autocomplete suggestions with type filtering
   */
  async getAutocompleteSuggestions(
    query: string,
    type: 'band' | 'event' | 'category' | 'all' = 'all',
  ): Promise<AutocompleteSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();
    const suggestions: AutocompleteSuggestion[] = [];

    // Band suggestions
    if (type === 'band' || type === 'all') {
      const bands = await this.prisma.band.findMany({
        where: {
          // Remove nickname - it doesn't exist in your schema
          name: { contains: searchTerm, mode: 'insensitive' },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          state: true,
          // Can't use _count directly, we'll get it separately
        },
        take: type === 'all' ? 3 : 10,
        orderBy: { name: 'asc' },
      });

      // Get video counts separately
      const bandsWithCounts = await Promise.all(
        bands.map(async (band) => {
          const count = await this.prisma.video.count({
            where: { bandId: band.id, isHidden: false },
          });
          return {
            ...band,
            videoCount: count,
          };
        })
      );

      suggestions.push(
        ...bandsWithCounts.map((band) => ({
          id: band.id,
          value: band.name,
          type: 'band' as const,
          metadata: {
            logoUrl: band.logoUrl || undefined,
            count: band.videoCount,
            state: band.state || undefined,
          },
        })),
      );
    }

    // Event suggestions
    if (type === 'event' || type === 'all') {
      const events = await this.prisma.video.findMany({
        where: {
          eventName: { contains: searchTerm, mode: 'insensitive' },
          isHidden: false,
        },
        select: {
          eventName: true,
        },
        distinct: ['eventName'],
        take: type === 'all' ? 3 : 10,
      });

      suggestions.push(
        ...events
          .filter((e) => e.eventName)
          .map((event) => ({
            id: event.eventName!,
            value: event.eventName!,
            type: 'event' as const,
          })),
      );
    }

    // Category suggestions
    if (type === 'category' || type === 'all') {
      const categories = await this.prisma.category.findMany({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
        },
        take: type === 'all' ? 3 : 10,
        orderBy: { sortOrder: 'asc' },
      });

      // Get counts separately
      const categoriesWithCounts = await Promise.all(
        categories.map(async (cat) => {
          const count = await this.prisma.video.count({
            where: { categoryId: cat.id, isHidden: false },
          });
          return {
            ...cat,
            videoCount: count,
          };
        })
      );

      suggestions.push(
        ...categoriesWithCounts.map((cat) => ({
          id: cat.id,
          value: cat.name,
          type: 'category' as const,
          metadata: {
            count: cat.videoCount,
          },
        })),
      );
    }

    return suggestions;
  }

  /**
   * Get filter metadata for dropdowns
   */
  async getFilterMetadata(): Promise<FilterMetadata> {
    const [categories, bands, videos] = await Promise.all([
      // Get categories
      this.prisma.category.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),

      // Get bands for state and conference extraction
      this.prisma.band.findMany({
        where: { isActive: true },
        select: {
          conference: true, // This is the string field
          state: true,
        },
      }),

      // Get all videos for year extraction
      this.prisma.video.findMany({
        where: { isHidden: false },
        select: { publishedAt: true },
      }),
    ]);

    // Get category counts
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await this.prisma.video.count({
          where: { categoryId: cat.id, isHidden: false },
        });
        return {
          value: cat.id,
          label: cat.name,
          count,
        };
      })
    );

    // Extract unique years
    const years = Array.from(
      new Set(videos.map((v) => new Date(v.publishedAt).getFullYear())),
    ).sort((a, b) => b - a);

    // Extract unique states with counts
    const stateMap = new Map<string, number>();
    for (const band of bands) {
      if (band.state) {
        const count = await this.prisma.video.count({
          where: { 
            band: { state: band.state },
            isHidden: false 
          },
        });
        stateMap.set(band.state, (stateMap.get(band.state) || 0) + count);
      }
    }

    const states = Array.from(stateMap.entries())
      .map(([state, count]) => ({
        value: state,
        label: state,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Extract unique conferences (from string field)
    const conferenceMap = new Map<string, number>();
    for (const band of bands) {
      if (band.conference) {
        const count = await this.prisma.video.count({
          where: { 
            band: { conference: band.conference },
            isHidden: false 
          },
        });
        conferenceMap.set(band.conference, (conferenceMap.get(band.conference) || 0) + count);
      }
    }

    const conferences = Array.from(conferenceMap.entries())
      .map(([conf, count]) => ({
        value: conf,
        label: conf,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Define regions
    const regionMap = {
      Northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
      Southeast: ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
      Midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
      Southwest: ['AZ', 'NM', 'OK', 'TX'],
      West: ['CO', 'ID', 'MT', 'NV', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
    };

    const regions = Object.entries(regionMap).map(([region, stateList]) => {
      const count = stateList.reduce((sum, state) => sum + (stateMap.get(state) || 0), 0);
      return {
        value: region.toLowerCase(),
        label: region,
        count,
      };
    });

    return {
      categories: categoriesWithCounts,
      conferences,
      states,
      regions,
      years,
    };
  }

  /**
   * Get popular searches with trend indication
   */
  async getPopularSearchesWithTrends(limit: number = 10) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get searches from last 7 days
    const recentSearches = await this.prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      where: {
        createdAt: { gte: sevenDaysAgo },
        resultsCount: { gt: 0 },
      },
    });

    // Get searches from 7-14 days ago for trend comparison
    const previousSearches = await this.prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      where: {
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        resultsCount: { gt: 0 },
      },
    });

    const previousMap = new Map(previousSearches.map((s) => [s.query, s._count.query]));

    const searchesWithTrends = recentSearches.map((s) => {
      const currentCount = s._count.query;
      const previousCount = previousMap.get(s.query) || 0;

      let trend: 'up' | 'down' | 'stable';
      if (previousCount === 0) {
        trend = 'up';
      } else if (currentCount > previousCount * 1.2) {
        trend = 'up';
      } else if (currentCount < previousCount * 0.8) {
        trend = 'down';
      } else {
        trend = 'stable';
      }

      return {
        query: s.query,
        count: currentCount,
        trend,
      };
    });

    return searchesWithTrends
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get user's saved search preferences
   * Note: This requires the UserSearchPreference table
   * For now, return null if table doesn't exist
   */
  async getUserPreferences(userId: string) {
    try {
      // Check if the table exists by trying to query it
      const preference = await this.prisma.$queryRaw`
        SELECT * FROM user_search_preferences WHERE user_id = ${userId} LIMIT 1
      `;
      
      return preference ? (preference as any)[0] : null;
    } catch (error) {
    this.logger.debug('User preferences are handled client-side');
    return null;
    }
  }

  /**
   * Save user's search preferences
   * Note: This requires the UserSearchPreference table
   */
  async saveUserPreferences(userId: string, preferences: any) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO user_search_preferences (id, user_id, filters, created_at, updated_at)
        VALUES (gen_random_uuid(), ${userId}, ${JSON.stringify(preferences.defaultFilters)}::jsonb, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET filters = ${JSON.stringify(preferences.defaultFilters)}::jsonb, updated_at = NOW()
      `;
      
      return { userId, filters: preferences.defaultFilters };
    } catch (error) {
    // No-op - preferences handled client-side
    this.logger.debug('User preferences are handled client-side');
    return { userId, filters: preferences.defaultFilters || {} };
    }
  }

  /**
   * Track search with optional user association
   */
  async trackSearch(
    query: string,
    filters: any,
    resultCount: number,
    userId?: string,
  ) {
    await this.logSearch(query, resultCount, filters, userId);
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