import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  VideoSearchQuery, 
  SearchResponse, 
  VideoSearchResult,
  SearchUIState 
} from '@/types/search';
import { searchVideos, trackSearch, SearchAPIError } from '@/lib/api/search';

interface UseVideoSearchOptions {
  /** Enable automatic search when query changes */
  autoSearch?: boolean;
  /** Debounce delay for auto search (ms) */
  debounceMs?: number;
  /** Callback when search completes */
  onSearchComplete?: (results: SearchResponse) => void;
  /** Callback when error occurs */
  onError?: (error: SearchAPIError) => void;
}

/**
 * Main hook for video search functionality
 * Handles API calls, loading states, error handling, and result management
 */
export function useVideoSearch(
  initialQuery?: VideoSearchQuery,
  options: UseVideoSearchOptions = {}
) {
  const {
    autoSearch = false,
    debounceMs = 300,
    onSearchComplete,
    onError,
  } = options;

  // Search results state
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTime, setSearchTime] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // UI state
  const [uiState, setUIState] = useState<SearchUIState>({
    isSearching: false,
    showFilters: false,
    showHistory: false,
    activeFilterCount: 0,
  });

  // Track current query
  const [currentQuery, setCurrentQuery] = useState<VideoSearchQuery>(
    initialQuery || {}
  );

  // Refs for cleanup and debouncing
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef<string>('');

  /**
   * Perform search with current query
   */
  const performSearch = useCallback(async (
    query: VideoSearchQuery,
    append: boolean = false
  ) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // Deduplicate identical searches
    const queryString = JSON.stringify(query);
    if (queryString === lastSearchRef.current && !append) {
      return;
    }
    lastSearchRef.current = queryString;

    setUIState(prev => ({ ...prev, isSearching: true, error: undefined }));

    try {
      const response = await searchVideos(
        query,
        abortControllerRef.current.signal
      );

      // Update results (append for pagination, replace for new search)
      setResults(prev => append ? [...prev, ...response.results] : response.results);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
      setSearchTime(response.searchTime);
      setHasMore(response.hasMore);

      setUIState(prev => ({ ...prev, isSearching: false }));

      // Track search for analytics (fire and forget)
      if (query.q) {
        trackSearch(query.q, query, response.total).catch(() => {
          // Silently fail analytics
        });
      }

      // Callback
      onSearchComplete?.(response);

    } catch (error) {
      // Ignore abort errors (user cancelled search)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const searchError = error instanceof SearchAPIError 
        ? error 
        : new SearchAPIError('An unexpected error occurred');

      setUIState(prev => ({
        ...prev,
        isSearching: false,
        error: searchError.message,
      }));

      onError?.(searchError);
    }
  }, [onSearchComplete, onError]);

  /**
   * Search with debouncing (for auto-search)
   */
  const debouncedSearch = useCallback((query: VideoSearchQuery) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, debounceMs);
  }, [performSearch, debounceMs]);

  /**
   * Public method to trigger search
   */
  const search = useCallback((query: VideoSearchQuery) => {
    setCurrentQuery(query);
    if (autoSearch) {
      debouncedSearch(query);
    } else {
      performSearch(query);
    }
  }, [autoSearch, debouncedSearch, performSearch]);

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(() => {
    if (!hasMore || uiState.isSearching) return;

    const nextPage = currentPage + 1;
    const nextQuery = { ...currentQuery, page: nextPage };
    
    performSearch(nextQuery, true);
  }, [currentPage, currentQuery, hasMore, uiState.isSearching, performSearch]);

  /**
   * Retry last search (useful after error)
   */
  const retry = useCallback(() => {
    performSearch(currentQuery);
  }, [currentQuery, performSearch]);

  /**
   * Clear results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setTotal(0);
    setTotalPages(0);
    setCurrentPage(1);
    setHasMore(false);
    lastSearchRef.current = '';
  }, []);

  /**
   * Toggle filters panel
   */
  const toggleFilters = useCallback(() => {
    setUIState(prev => ({ ...prev, showFilters: !prev.showFilters }));
  }, []);

  /**
   * Toggle history panel
   */
  const toggleHistory = useCallback(() => {
    setUIState(prev => ({ ...prev, showHistory: !prev.showHistory }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    // Results
    results,
    total,
    totalPages,
    currentPage,
    searchTime,
    hasMore,

    // UI State
    isSearching: uiState.isSearching,
    error: uiState.error,
    showFilters: uiState.showFilters,
    showHistory: uiState.showHistory,

    // Actions
    search,
    loadMore,
    retry,
    clearResults,
    toggleFilters,
    toggleHistory,

    // Current query
    currentQuery,
  };
}