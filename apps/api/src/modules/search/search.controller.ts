import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService, SearchFilters } from './search.service';
import { ApiErrorDto } from '../../common/dto/api-error.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Advanced search', description: 'Full-text search across videos with extensive filtering capabilities.' })
 @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search parameters', type: ApiErrorDto })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({ name: 'bandIds', required: false, description: 'Comma-separated band IDs' })
  @ApiQuery({ name: 'categoryIds', required: false, description: 'Comma-separated category IDs' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'durationMin', required: false, description: 'Minimum duration in seconds' })
  @ApiQuery({ name: 'durationMax', required: false, description: 'Maximum duration in seconds' })
  @ApiQuery({ name: 'viewCountMin', required: false, description: 'Minimum view count' })
  @ApiQuery({ name: 'viewCountMax', required: false, description: 'Maximum view count' })
  @ApiQuery({ name: 'hasOpponent', required: false, description: 'Filter by has opponent band' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['relevance', 'publishedAt', 'viewCount', 'title'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async search(
    @Query('q') query?: string,
    @Query('bandIds') bandIds?: string,
    @Query('categoryIds') categoryIds?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('durationMin') durationMin?: string,
    @Query('durationMax') durationMax?: string,
    @Query('viewCountMin') viewCountMin?: string,
    @Query('viewCountMax') viewCountMax?: string,
    @Query('hasOpponent') hasOpponent?: string,
    @Query('sortBy') sortBy?: 'relevance' | 'publishedAt' | 'viewCount' | 'title',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const filters: SearchFilters = {
      query,
      bandIds: bandIds ? bandIds.split(',') : undefined,
      categoryIds: categoryIds ? categoryIds.split(',') : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
      durationMax: durationMax ? parseInt(durationMax, 10) : undefined,
      viewCountMin: viewCountMin ? parseInt(viewCountMin, 10) : undefined,
      viewCountMax: viewCountMax ? parseInt(viewCountMax, 10) : undefined,
      hasOpponent: hasOpponent === 'true' ? true : hasOpponent === 'false' ? false : undefined,
      sortBy: sortBy || 'relevance',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    };

    const results = await this.searchService.search(filters);

    // Log the search for analytics (async, don't wait)
    if (query && query.trim().length > 0) {
      this.searchService.logSearch(
        query,
        results.meta.total,
        { ...filters, query: undefined },
        undefined,
        sessionId,
      ).catch(() => {
        // Silently ignore logging errors
      });
    }

    return results;
  }

@Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions', description: 'Returns auto-complete suggestions based on partial input.' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial search term' })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved' })
  async getSuggestions(@Query('q') query: string) {
    return this.searchService.getSuggestions(query);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular searches from the last 7 days' })
  @ApiResponse({ status: 200, description: 'Popular searches retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum searches to return' })
  async getPopularSearches(@Query('limit') limit?: string) {
    return this.searchService.getPopularSearches(limit ? parseInt(limit, 10) : 10);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available filter options for search' })
  @ApiResponse({ status: 200, description: 'Filter options retrieved successfully' })
  async getFilterOptions() {
    const [bands, categories] = await Promise.all([
      this.searchService.getBandsForFilter(),
      this.searchService.getCategoriesForFilter(),
    ]);

    return { bands, categories };
  }
}