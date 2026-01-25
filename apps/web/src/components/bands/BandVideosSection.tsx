'use client';

import { useState, useEffect } from 'react';
import { VideoCard } from '@/components/videos/VideoCard';
import {
  useInfiniteVideos,
  InfiniteScrollLoader,
  LoadMoreButton,
  EmptyVideosState,
  EndOfResults,
} from '@/hooks/useInfiniteVideos';
import type { Video, VideoCategory } from '@/types/api';
import { VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';

interface BandVideosSectionProps {
  bandId: string;
  bandName: string;
  initialVideos: Video[];
  initialTotal: number;
}

// Generate year options from 2010 to current year
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= 2010; year--) {
    years.push(year);
  }
  return years;
}

export function BandVideosSection({
  bandId,
  bandName,
  initialVideos,
  initialTotal,
}: BandVideosSectionProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VideoCategory | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'publishedAt' | 'viewCount' | 'title'>('publishedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Build filters object
  const filters = {
    bandId,
    search: search || undefined,
    category: category || undefined,
    year: year || undefined,
    sortBy,
    sortOrder,
  };

  const {
    videos,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalCount,
    sentinelRef,
    isEmpty,
    isReachingEnd,
  } = useInfiniteVideos({
    filters,
    limit: 12,
    enabled: true,
  });

  // Use initial videos while loading the first query result
  const displayVideos = videos.length > 0 ? videos : initialVideos;
  const displayTotal = totalCount > 0 ? totalCount : initialTotal;

  // Check if there are any active filters beyond bandId
  const hasActiveFilters = !!(search || category || year);

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setYear('');
    setSortBy('publishedAt');
    setSortOrder('desc');
  };

  const yearOptions = getYearOptions();

  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Videos</h2>
        <p className="text-sm text-gray-600">
          {displayTotal.toLocaleString()} {displayTotal === 1 ? 'video' : 'videos'} from {bandName}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
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
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as VideoCategory | '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {Object.entries(VIDEO_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label htmlFor="year" className="block text-xs font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label htmlFor="sort" className="block text-xs font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as [
                  'publishedAt' | 'viewCount' | 'title',
                  'asc' | 'desc'
                ];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="publishedAt-desc">Newest First</option>
              <option value="publishedAt-asc">Oldest First</option>
              <option value="viewCount-desc">Most Viewed</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>
          </div>
        </div>

        {/* Active Filters & Clear */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
            <span className="text-xs text-gray-500">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {search && (
                <span className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                  Search: {search}
                  <button
                    onClick={() => setSearch('')}
                    className="hover:text-primary-900"
                    aria-label="Remove search filter"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                  {VIDEO_CATEGORY_LABELS[category]}
                  <button
                    onClick={() => setCategory('')}
                    className="hover:text-primary-900"
                    aria-label="Remove category filter"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {year && (
                <span className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                  {year}
                  <button
                    onClick={() => setYear('')}
                    className="hover:text-primary-900"
                    aria-label="Remove year filter"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {isEmpty && !isLoading && (
        <EmptyVideosState hasFilters={hasActiveFilters} />
      )}

      {/* Video Grid */}
      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          {/* Infinite scroll trigger / Load More section */}
          <div className="mt-8">
            {/* Intersection observer sentinel (hidden but functional) */}
            {!prefersReducedMotion && hasNextPage && (
              <div
                ref={sentinelRef as React.RefCallback<HTMLDivElement>}
                className="h-1"
                aria-hidden="true"
              />
            )}

            {/* Loading indicator */}
            <InfiniteScrollLoader isFetching={isFetchingNextPage} hasMore={hasNextPage} />

            {/* Accessibility fallback: Load More button for reduced motion or keyboard users */}
            {(prefersReducedMotion || hasNextPage) && (
              <LoadMoreButton
                onClick={fetchNextPage}
                isLoading={isFetchingNextPage}
                hasMore={hasNextPage}
              />
            )}

            {/* End of results indicator */}
            {isReachingEnd && <EndOfResults totalCount={displayTotal} />}
          </div>
        </>
      )}
    </div>
  );
}
