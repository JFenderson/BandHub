'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdvancedSearchBar, FilterSidebar, SearchResults, ViewToggle } from '@/components/search';
import type { ViewMode } from '@/components/search';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SearchMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string | null;
}

interface PopularSearch {
  query: string;
  count: number;
}

interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string | Date;
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

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'relevance');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const query = searchParams.get('q') || '';

  // Fetch popular searches on mount
  useEffect(() => {
    const fetchPopularSearches = async () => {
      try {
        const response = await fetch(`${API_URL}/search/popular?limit=5`);
        if (response.ok) {
          const data = await response.json();
          setPopularSearches(data.popularSearches || []);
        }
      } catch (error) {
        console.error('Failed to fetch popular searches:', error);
      }
    };

    fetchPopularSearches();
  }, []);

  // Fetch search results
  const fetchResults = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams(searchParams);
      
      // Ensure sort params are set
      if (!params.has('sortBy')) params.set('sortBy', sortBy);
      if (!params.has('sortOrder')) params.set('sortOrder', sortOrder);

      const response = await fetch(`${API_URL}/search?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.data || []);
        setMeta(data.meta || null);
      } else {
        setResults([]);
        setMeta(null);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, sortBy, sortOrder]);

  // Fetch results when search params change
  useEffect(() => {
    // Only fetch if there's a query or filters
    if (searchParams.toString()) {
      fetchResults();
    } else {
      setResults([]);
      setMeta(null);
    }
  }, [searchParams, fetchResults]);

  const handleSearch = (searchQuery: string) => {
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset pagination
    router.push(`/search?${params.toString()}`);
  };

  const handleSortChange = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', newSortBy);
    params.set('sortOrder', sortOrder);
    params.delete('page');
    setSortBy(newSortBy);
    router.push(`/search?${params.toString()}`);
  };

  const handleSortOrderChange = (newSortOrder: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', sortBy);
    params.set('sortOrder', newSortOrder);
    params.delete('page');
    setSortOrder(newSortOrder);
    router.push(`/search?${params.toString()}`);
  };

  const handleLoadMore = () => {
    if (meta && meta.page < meta.totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', (meta.page + 1).toString());
      router.push(`/search?${params.toString()}`);
    }
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="container-custom py-6">
          <div className="max-w-3xl mx-auto">
            <AdvancedSearchBar
              initialQuery={query}
              onSearch={handleSearch}
              autoFocus={!query}
              placeholder="Search videos, bands, events..."
            />
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        <div className="flex gap-6">
          {/* Filter Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-36">
              <FilterSidebar />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Results Header */}
            {meta && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">
                    {meta.total > 0 ? (
                      <>
                        <span className="font-medium">{meta.total.toLocaleString()}</span> result
                        {meta.total !== 1 ? 's' : ''}
                        {query && (
                          <>
                            {' '}for &quot;<span className="font-medium">{query}</span>&quot;
                          </>
                        )}
                      </>
                    ) : (
                      <>No results found</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Mobile Filter Button */}
                  <button
                    onClick={() => setShowMobileFilters(true)}
                    className="lg:hidden px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                  </button>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="sort" className="text-sm text-gray-600 hidden sm:inline">
                      Sort by:
                    </label>
                    <select
                      id="sort"
                      value={sortBy}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="publishedAt">Date</option>
                      <option value="viewCount">Views</option>
                      <option value="title">Title</option>
                    </select>
                    <button
                      onClick={() => handleSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
                      title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    >
                      {sortOrder === 'desc' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* View Toggle */}
                  <ViewToggle currentView={view} onViewChange={setView} />
                </div>
              </div>
            )}

            {/* Search Results or Landing State */}
            {!searchParams.toString() ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  Search HBCU Band Videos
                </h2>
                <p className="mt-2 text-gray-600 max-w-md mx-auto">
                  Find performances from your favorite bands. Search by band name, event, video title, or use filters to narrow down results.
                </p>

                {/* Popular Searches */}
                {popularSearches.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Popular Searches</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                      {popularSearches.map((search) => (
                        <button
                          key={search.query}
                          onClick={() => handleSearch(search.query)}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-primary-500 hover:text-primary-600 transition-colors"
                        >
                          {search.query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <a
                    href="/bands"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Browse all bands →
                  </a>
                  <a
                    href="/videos"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Browse all videos →
                  </a>
                </div>
              </div>
            ) : (
              <>
                <SearchResults
                  results={results}
                  view={view}
                  query={query}
                  isLoading={isLoading}
                />

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">
                      Showing {((meta.page - 1) * meta.limit) + 1} -{' '}
                      {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(meta.page - 1)}
                        disabled={meta.page <= 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                          let page: number;
                          if (meta.totalPages <= 5) {
                            page = i + 1;
                          } else if (meta.page <= 3) {
                            page = i + 1;
                          } else if (meta.page >= meta.totalPages - 2) {
                            page = meta.totalPages - 4 + i;
                          } else {
                            page = meta.page - 2 + i;
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                page === meta.page
                                  ? 'bg-primary-600 text-white'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(meta.page + 1)}
                        disabled={meta.page >= meta.totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>

                    {/* Load More (alternative) */}
                    {meta.page < meta.totalPages && (
                      <button
                        onClick={handleLoadMore}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 sm:hidden"
                      >
                        Load More
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto pb-20">
              <FilterSidebar onFiltersChange={() => setShowMobileFilters(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
