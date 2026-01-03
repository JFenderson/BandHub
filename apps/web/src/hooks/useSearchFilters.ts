import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { VideoSearchQuery, SearchFilters } from '@/types/search';
import { 
  encodeSearchToURL, 
  decodeSearchFromURL, 
  countActiveFilters,
  hasActiveFilters as checkHasActiveFilters,
  clearAllFilters as clearFilters,
  mergeFilters
} from '@/lib/utils/searchParams';

/**
 * Manage search filters with URL synchronization
 * Keeps filter state in sync with browser URL for shareable searches
 */
export function useSearchFilters(initialQuery?: VideoSearchQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Initialize state from URL or props
  const [query, setQuery] = useState<VideoSearchQuery>(() => {
    if (searchParams) {
      return decodeSearchFromURL(searchParams);
    }
    return initialQuery || {};
  });

  /**
   * Update URL when query changes
   */
  useEffect(() => {
    const urlString = encodeSearchToURL(query);
    const newUrl = urlString ? `${pathname}?${urlString}` : pathname;
    
    // Only update if URL actually changed (prevents infinite loops)
    if (newUrl !== `${pathname}?${searchParams?.toString() || ''}`) {
      router.replace(newUrl, { scroll: false });
    }
  }, [query, pathname, router, searchParams]);

  /**
   * Update search query text
   */
  const setSearchQuery = useCallback((q: string) => {
    setQuery(prev => ({ ...prev, q, page: 1 }));
  }, []);

  /**
   * Update a specific filter
   */
  const updateFilter = useCallback(<K extends keyof VideoSearchQuery>(
    key: K,
    value: VideoSearchQuery[K]
  ) => {
    setQuery(prev => mergeFilters(prev, { [key]: value }));
  }, []);

  /**
   * Update multiple filters at once
   */
  const updateFilters = useCallback((updates: Partial<VideoSearchQuery>) => {
    setQuery(prev => mergeFilters(prev, updates));
  }, []);

  /**
   * Clear all filters but keep search query
   */
  const clearAllFilters = useCallback(() => {
    setQuery(prev => clearFilters(prev));
  }, []);

  /**
   * Reset everything including search query
   */
  const resetAll = useCallback(() => {
    setQuery({});
  }, []);

  /**
   * Toggle a value in an array filter (e.g., categories, years)
   */
  const toggleArrayFilter = useCallback(<K extends keyof VideoSearchQuery>(
    key: K,
    value: string | number
  ) => {
    setQuery(prev => {
      const currentArray = (prev[key] || []) as Array<string | number>;
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      
      return mergeFilters(prev, { [key]: newArray.length > 0 ? newArray : undefined } as any);
    });
  }, []);

  /**
   * Set page number (for pagination)
   */
  const setPage = useCallback((page: number) => {
    setQuery(prev => ({ ...prev, page }));
  }, []);

  /**
   * Set sort options
   */
  const setSort = useCallback((
    sortBy: VideoSearchQuery['sortBy'],
    sortOrder: VideoSearchQuery['sortOrder'] = 'desc'
  ) => {
    setQuery(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  }, []);

  return {
    query,
    setQuery,
    setSearchQuery,
    updateFilter,
    updateFilters,
    clearAllFilters,
    resetAll,
    toggleArrayFilter,
    setPage,
    setSort,
    activeFilterCount: countActiveFilters(query as any),
    hasActiveFilters: checkHasActiveFilters(query),
  };
}