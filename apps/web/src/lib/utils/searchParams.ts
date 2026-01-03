import { VideoSearchQuery, SearchFilters } from '@/types/search';
import { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * Encode search state to URL parameters
 * Makes searches shareable and enables browser back/forward
 */
export function encodeSearchToURL(query: VideoSearchQuery): string {
  const params = new URLSearchParams();

  if (query.q) params.set('q', query.q);
  if (query.bandIds?.length) params.set('bandIds', query.bandIds.join(','));
  if (query.categoryIds?.length) params.set('categoryIds', query.categoryIds.join(','));
  if (query.years?.length) params.set('years', query.years.join(','));
  if (query.conferences?.length) params.set('conferences', query.conferences.join(','));  // Changed
  if (query.states?.length) params.set('states', query.states.join(','));
  if (query.regions?.length) params.set('regions', query.regions.join(','));
  if (query.eventName) params.set('eventName', query.eventName);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.sortBy && query.sortBy !== 'relevance') params.set('sortBy', query.sortBy);
  if (query.sortOrder && query.sortOrder !== 'desc') params.set('sortOrder', query.sortOrder);
  if (query.page && query.page > 1) params.set('page', String(query.page));

  return params.toString();
}

/**
 * Decode URL parameters to search state
 */
export function decodeSearchFromURL(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): VideoSearchQuery {
  const query: VideoSearchQuery = {};

  const q = searchParams.get('q');
  if (q) query.q = q;

  const bandIds = searchParams.get('bandIds');
  if (bandIds) query.bandIds = bandIds.split(',').filter(Boolean);

  const categoryIds = searchParams.get('categoryIds');
  if (categoryIds) query.categoryIds = categoryIds.split(',').filter(Boolean);

  const years = searchParams.get('years');
  if (years) {
    query.years = years.split(',').map(Number).filter(y => !isNaN(y));
  }

  const conferences = searchParams.get('conferences');  // Changed
  if (conferences) query.conferences = conferences.split(',').filter(Boolean);

  const states = searchParams.get('states');
  if (states) query.states = states.split(',').filter(Boolean);

  const regions = searchParams.get('regions');
  if (regions) query.regions = regions.split(',').filter(Boolean);

  const eventName = searchParams.get('eventName');
  if (eventName) query.eventName = eventName;

  const dateFrom = searchParams.get('dateFrom');
  if (dateFrom) query.dateFrom = dateFrom;

  const dateTo = searchParams.get('dateTo');
  if (dateTo) query.dateTo = dateTo;

  const sortBy = searchParams.get('sortBy') as VideoSearchQuery['sortBy'];
  if (sortBy) query.sortBy = sortBy;

  const sortOrder = searchParams.get('sortOrder') as VideoSearchQuery['sortOrder'];
  if (sortOrder) query.sortOrder = sortOrder;

  const page = searchParams.get('page');
  if (page) query.page = parseInt(page, 10);

  return query;
}

/**
 * Count active filters (for badge display)
 */
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;

  if (filters.categories?.length) count += filters.categories.length;
  if (filters.years?.length) count += filters.years.length;
  if (filters.conferences?.length) count += filters.conferences.length;
  if (filters.states?.length) count += filters.states.length;
  if (filters.regions?.length) count += filters.regions.length;
  if (filters.dateRange?.from || filters.dateRange?.to) count += 1;

  return count;
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(query: VideoSearchQuery): boolean {
  return !!(
    query.bandIds?.length ||
    query.categoryIds?.length ||
    query.years?.length ||
    query.conferences?.length ||
    query.states?.length ||
    query.regions?.length ||
    query.eventName ||
    query.dateFrom ||
    query.dateTo
  );
}

/**
 * Clear all filters but keep search query
 */
export function clearAllFilters(query: VideoSearchQuery): VideoSearchQuery {
  return {
    q: query.q,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: 1,
  };
}

/**
 * Merge new filters with existing query
 */
export function mergeFilters(
  current: VideoSearchQuery,
  updates: Partial<VideoSearchQuery>
): VideoSearchQuery {
  return {
    ...current,
    ...updates,
    page: 1, // Reset to first page when filters change
  };
}