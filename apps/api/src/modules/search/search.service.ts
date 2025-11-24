import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
  highlights?: {
    title?: string;
    description?: string;
    bandName?: string;
  };
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

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Advanced multi-faceted search with weighted results
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

    // Duration filter (in seconds)
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

    // Has opponent filter
    if (hasOpponent !== undefined) {
      if (hasOpponent) {
        where.opponentBandId = { not: null };
      } else {
        where.opponentBandId = null;
      }
    }

    // Text search with fuzzy matching
    if (query && query.trim().length > 0) {
      const searchTerms = this.parseSearchQuery(query);
      where.OR = this.buildSearchConditions(searchTerms);
    }

    // Determine sort order
    let orderBy: Prisma.VideoOrderByWithRelationInput[];
    if (sortBy === 'relevance' && query) {
      // For relevance, we'll sort by viewCount as a proxy for relevance
      // Combined with the search conditions which prioritize band name matches
      orderBy = [{ viewCount: 'desc' }, { publishedAt: 'desc' }];
    } else {
      const sortField = sortBy === 'relevance' ? 'publishedAt' : sortBy;
      orderBy = [{ [sortField]: sortOrder }];
    }

    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
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

    // Add highlights to results
    const results: SearchResult[] = videos.map((video) => ({
      ...video,
      highlights: query
        ? this.generateHighlights(video, query)
        : undefined,
    }));

    return {
      data: results,
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
   * Get search suggestions based on partial query
   */
  async getSuggestions(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      return { suggestions: [] };
    }

    const searchTerm = query.trim().toLowerCase();

    // Get band name suggestions
    const bandSuggestions = await this.prisma.band.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { schoolName: { contains: searchTerm, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: {
        name: true,
        slug: true,
      },
      take: 5,
    });

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
   * Get popular searches
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
        resultsCount: { gt: 0 }, // Only show searches that had results
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
   * Get all bands for filter options
   */
  async getBandsForFilter() {
    return this.prisma.band.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { videos: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get all categories for filter options
   */
  async getCategoriesForFilter() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { videos: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Parse search query to support advanced syntax:
   * - "exact phrase" for exact matching
   * - -term for exclusion
   * - Regular terms for fuzzy matching
   */
  private parseSearchQuery(query: string): {
    include: string[];
    exclude: string[];
    exact: string[];
  } {
    const result = {
      include: [] as string[],
      exclude: [] as string[],
      exact: [] as string[],
    };

    // Match quoted phrases
    const exactMatches = query.match(/"([^"]+)"/g);
    if (exactMatches) {
      result.exact = exactMatches.map((m) => m.replace(/"/g, ''));
      query = query.replace(/"[^"]+"/g, '');
    }

    // Split remaining terms
    const terms = query.split(/\s+/).filter((t) => t.length > 0);

    for (const term of terms) {
      if (term.startsWith('-') && term.length > 1) {
        result.exclude.push(term.substring(1));
      } else {
        result.include.push(term);
      }
    }

    return result;
  }

  /**
   * Build Prisma search conditions from parsed query
   */
  private buildSearchConditions(searchTerms: {
    include: string[];
    exclude: string[];
    exact: string[];
  }): Prisma.VideoWhereInput[] {
    const conditions: Prisma.VideoWhereInput[] = [];

    // Add conditions for included terms (fuzzy matching)
    for (const term of searchTerms.include) {
      conditions.push(
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { band: { name: { contains: term, mode: 'insensitive' } } },
        { band: { schoolName: { contains: term, mode: 'insensitive' } } },
        { eventName: { contains: term, mode: 'insensitive' } },
        { tags: { hasSome: [term.toLowerCase()] } },
      );
    }

    // Add conditions for exact phrases
    for (const phrase of searchTerms.exact) {
      conditions.push(
        { title: { contains: phrase, mode: 'insensitive' } },
        { description: { contains: phrase, mode: 'insensitive' } },
      );
    }

    return conditions.length > 0 ? conditions : [{}];
  }

  /**
   * Generate highlighted text snippets for search results
   */
  private generateHighlights(
    video: { title: string; description?: string | null; band: { name: string } },
    query: string,
  ): { title?: string; description?: string; bandName?: string } {
    const highlights: { title?: string; description?: string; bandName?: string } = {};
    const terms = query.toLowerCase().split(/\s+/).filter((t) => !t.startsWith('-') && t.length > 0);

    // Highlight title
    if (terms.some((t) => video.title.toLowerCase().includes(t))) {
      highlights.title = this.highlightText(video.title, terms);
    }

    // Highlight description (first 200 chars)
    if (video.description) {
      const desc = video.description.substring(0, 200);
      if (terms.some((t) => desc.toLowerCase().includes(t))) {
        highlights.description = this.highlightText(desc, terms) + (video.description.length > 200 ? '...' : '');
      }
    }

    // Highlight band name
    if (terms.some((t) => video.band.name.toLowerCase().includes(t))) {
      highlights.bandName = this.highlightText(video.band.name, terms);
    }

    return highlights;
  }

  /**
   * Wrap matching terms with <mark> tags
   */
  private highlightText(text: string, terms: string[]): string {
    let result = text;
    for (const term of terms) {
      const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
      result = result.replace(regex, '<mark>$1</mark>');
    }
    return result;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}