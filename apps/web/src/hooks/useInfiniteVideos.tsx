'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import type { Video, VideoFilters, PaginatedResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface UseInfiniteVideosOptions {
  filters?: Omit<VideoFilters, 'page'>;
  limit?: number;
  enabled?: boolean;
}

interface UseInfiniteVideosReturn {
  videos: Video[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  totalCount: number;
  sentinelRef: (node: HTMLElement | null) => void;
  isEmpty: boolean;
  isReachingEnd: boolean;
}

async function fetchVideosPage(
  filters: Omit<VideoFilters, 'page'>,
  page: number,
  limit: number
): Promise<PaginatedResponse<Video>> {
  const params = new URLSearchParams();

  if (filters.bandId) params.append('bandId', filters.bandId);
  if (filters.conference) params.append('conference', filters.conference);
  if (filters.category) params.append('category', filters.category);
  if (filters.year) params.append('eventYear', filters.year.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  const response = await fetch(`${API_URL}/videos?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch videos: ${response.status}`);
  }

  return response.json();
}

export function useInfiniteVideos({
  filters = {},
  limit = 16,
  enabled = true,
}: UseInfiniteVideosOptions = {}): UseInfiniteVideosReturn {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLElement | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery<
    PaginatedResponse<Video>,
    Error,
    InfiniteData<PaginatedResponse<Video>>,
    [string, Omit<VideoFilters, 'page'>],
    number
  >({
    queryKey: ['videos', filters],
    queryFn: ({ pageParam }) => fetchVideosPage(filters, pageParam, limit),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });

  // Flatten all pages into a single array of videos
  const videos = data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount = data?.pages[0]?.meta.total ?? 0;
  const isEmpty = !isLoading && videos.length === 0;
  const isReachingEnd = !isLoading && !hasNextPage && videos.length > 0;

  // Set up intersection observer for infinite scroll
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      sentinelNodeRef.current = node;

      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node || !hasNextPage || isFetchingNextPage) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        {
          rootMargin: '200px', // Trigger 200px before reaching the sentinel
          threshold: 0,
        }
      );

      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Scroll position restoration
  useEffect(() => {
    // Save scroll position before navigation
    const saveScrollPosition = () => {
      const scrollY = window.scrollY;
      const filterKey = JSON.stringify(filters);
      sessionStorage.setItem(`videos-scroll-${filterKey}`, scrollY.toString());
    };

    // Restore scroll position if returning to page
    const restoreScrollPosition = () => {
      const filterKey = JSON.stringify(filters);
      const savedPosition = sessionStorage.getItem(`videos-scroll-${filterKey}`);
      if (savedPosition && videos.length > 0) {
        // Use requestAnimationFrame to ensure DOM has rendered
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
        });
      }
    };

    // Only restore once data is loaded
    if (!isLoading && videos.length > 0) {
      restoreScrollPosition();
    }

    // Save position on beforeunload and when clicking links
    window.addEventListener('beforeunload', saveScrollPosition);

    // Also save on visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Save on any click that might navigate (delegate to document)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) {
        saveScrollPosition();
      }
    };
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleClick);
    };
  }, [filters, isLoading, videos.length]);

  return {
    videos,
    isLoading,
    isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    fetchNextPage,
    error: error as Error | null,
    totalCount,
    sentinelRef,
    isEmpty,
    isReachingEnd,
  };
}

// Loading indicator component for the bottom of the list
export function InfiniteScrollLoader({
  isFetching,
  hasMore,
}: {
  isFetching: boolean;
  hasMore: boolean;
}) {
  if (!isFetching && !hasMore) return null;

  return (
    <div className="flex justify-center py-8" role="status" aria-live="polite">
      {isFetching ? (
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <span className="text-sm text-gray-600">Loading more videos...</span>
        </div>
      ) : null}
    </div>
  );
}

// Load More button for accessibility fallback
export function LoadMoreButton({
  onClick,
  isLoading,
  hasMore,
}: {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
}) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={isLoading}
        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={isLoading ? 'Loading more videos' : 'Load more videos'}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Loading...
          </span>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  );
}

// Empty state component
export function EmptyVideosState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">No videos found</h3>
      <p className="mt-2 text-gray-500">
        {hasFilters
          ? 'Try adjusting your search or filter criteria'
          : 'Check back later for new content'}
      </p>
    </div>
  );
}

// End of results indicator
export function EndOfResults({ totalCount }: { totalCount: number }) {
  return (
    <div className="text-center py-8 text-gray-500">
      <p className="text-sm">
        You&apos;ve reached the end - {totalCount.toLocaleString()} videos total
      </p>
    </div>
  );
}
