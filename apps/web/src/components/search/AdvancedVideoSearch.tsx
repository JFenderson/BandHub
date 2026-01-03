'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, Loader2 } from 'lucide-react';
import { SearchInput } from './SearchInput';
import { FilterPanel } from './FilterPanel';
import { SearchResultsPreview } from './SearchResultsPreview';
import { SearchMetrics } from './SearchMetrics';
import { SearchHistory } from './SearchHistory';
import { PopularSearchesClient } from './PopularSearches';
import { useVideoSearch } from '@/hooks/useVideoSearch';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { VideoSearchQuery, PopularSearch } from '@/types/search';

interface AdvancedVideoSearchProps {
  initialQuery?: VideoSearchQuery;
  popularSearches?: PopularSearch[];
  autoFocus?: boolean;
  className?: string;
}

export function AdvancedVideoSearch({
  initialQuery,
  popularSearches = [],
  autoFocus = false,
  className = '',
}: AdvancedVideoSearchProps) {
  // Hooks
  const {
    query,
    setSearchQuery,
    updateFilters,
    clearAllFilters,
    activeFilterCount,
    hasActiveFilters,
  } = useSearchFilters(initialQuery);

  const {
    results,
    total,
    totalPages,
    currentPage,
    searchTime,
    hasMore,
    isSearching,
    error,
    showFilters,
    showHistory,
    search,
    loadMore,
    retry,
    toggleFilters,
    toggleHistory,
  } = useVideoSearch(query, {
    autoSearch: false,
    onSearchComplete: (response) => {
      // Add to history after successful search
      if (query.q || hasActiveFilters) {
        addSearch(query.q || '', query, response.total);
      }
    },
  });

  const {
    history,
    isLoaded: isHistoryLoaded,
    addSearch,
  } = useSearchHistory();

  const [searchInputValue, setSearchInputValue] = useState(query.q || '');
  const [hasSearched, setHasSearched] = useState(false);

  /**
   * Perform search when query changes (from filters, URL, etc.)
   */
  useEffect(() => {
    if (hasSearched) {
      search(query);
    }
  }, [query, hasSearched, search]);

  /**
   * Update search input when query changes from external source
   */
  useEffect(() => {
    if (query.q !== searchInputValue) {
      setSearchInputValue(query.q || '');
    }
  }, [query.q]);

  /**
   * Handle search submission
   */
  const handleSearch = (searchTerm: string) => {
    setSearchQuery(searchTerm);
    setHasSearched(true);
    
    // Close history panel after searching
    if (showHistory) {
      toggleHistory();
    }
  };

  /**
   * Handle selecting a search from history
   */
  const handleSelectHistorySearch = (searchQuery: string, filters: VideoSearchQuery) => {
    setSearchInputValue(searchQuery);
    updateFilters(filters);
    setHasSearched(true);
    toggleHistory();
  };

  /**
   * Handle selecting a popular search
   */
  const handleSelectPopularSearch = (searchQuery: string) => {
    setSearchInputValue(searchQuery);
    setSearchQuery(searchQuery);
    setHasSearched(true);
  };

  /**
   * Handle infinite scroll
   */
  useEffect(() => {
    if (!hasMore || isSearching) return;

    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 500;

      if (scrollPosition >= threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isSearching, loadMore]);

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Search HBCU Band Videos
          </h1>
          <p className="text-gray-600">
            Find performances, battles, parades, and more from your favorite HBCU bands
          </p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <SearchInput
            value={searchInputValue}
            onChange={setSearchInputValue}
            onSearch={handleSearch}
            autoFocus={autoFocus}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <button
              onClick={toggleFilters}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg 
                       transition-all ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* History Toggle */}
            {isHistoryLoaded && history.length > 0 && (
              <button
                onClick={toggleHistory}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg 
                         transition-all ${
                  showHistory
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">History</span>
              </button>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  clearAllFilters();
                  setHasSearched(true);
                }}
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Sort Options */}
          {hasSearched && results.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-gray-600">
                Sort by:
              </label>
              <select
                id="sort"
                value={`${query.sortBy || 'relevance'}-${query.sortOrder || 'desc'}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  updateFilters({
                    sortBy: sortBy as VideoSearchQuery['sortBy'],
                    sortOrder: sortOrder as VideoSearchQuery['sortOrder'],
                  });
                  setHasSearched(true);
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                         focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
              >
                <option value="relevance-desc">Relevance</option>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="views-desc">Most Viewed</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
              </select>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6">
          {/* Filters Sidebar (Desktop) */}
          {showFilters && (
            <div className="hidden lg:block w-80 flex-shrink-0">
              <FilterPanel
                isOpen={showFilters}
                onClose={toggleFilters}
                query={query}
                onFilterChange={(updates) => {
                  updateFilters(updates);
                  setHasSearched(true);
                }}
                onClearAll={() => {
                  clearAllFilters();
                  setHasSearched(true);
                }}
                activeFilterCount={activeFilterCount}
              />
            </div>
          )}

          {/* Mobile Filter Panel */}
          <FilterPanel
            isOpen={showFilters}
            onClose={toggleFilters}
            query={query}
            onFilterChange={(updates) => {
              updateFilters(updates);
              setHasSearched(true);
            }}
            onClearAll={() => {
              clearAllFilters();
              setHasSearched(true);
            }}
            activeFilterCount={activeFilterCount}
            className="lg:hidden"
          />

          {/* Results Area */}
          <div className="flex-1 min-w-0">
            {/* Search Metrics */}
            {hasSearched && !isSearching && !error && (
              <div className="mb-4">
                <SearchMetrics
                  total={total}
                  searchTime={searchTime}
                  currentPage={currentPage}
                  totalPages={totalPages}
                />
              </div>
            )}

            {/* History Panel */}
            {showHistory && !hasSearched && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <SearchHistory
                  onSelectSearch={handleSelectHistorySearch}
                />
              </div>
            )}

            {/* Popular Searches (before first search) */}
            {!hasSearched && !showHistory && popularSearches.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <PopularSearchesClient
                  searches={popularSearches}
                  onSelectSearch={handleSelectPopularSearch}
                />
              </div>
            )}

            {/* Search Results */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              {!hasSearched && !showHistory && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎺</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Start Your Search
                  </h3>
                  <p className="text-gray-600">
                    Enter keywords or use filters to find HBCU band videos
                  </p>
                </div>
              )}

              {hasSearched && (
                <SearchResultsPreview
                  results={results}
                  isLoading={isSearching}
                  error={error}
                  onRetry={retry}
                />
              )}

              {/* Load More Button */}
              {hasMore && !isSearching && results.length > 0 && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg
                             hover:bg-blue-700 transition-colors"
                  >
                    Load More Results
                  </button>
                </div>
              )}

              {/* Loading More Indicator */}
              {isSearching && results.length > 0 && (
                <div className="mt-8 flex justify-center">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading more results...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}