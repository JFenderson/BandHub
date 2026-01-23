'use client';

import { useEffect, useState } from 'react';
import { VideoCard } from './VideoCard';
import {
  useInfiniteVideos,
  InfiniteScrollLoader,
  LoadMoreButton,
  EmptyVideosState,
  EndOfResults,
} from '@/hooks/useInfiniteVideos';
import type { VideoFilters, Video } from '@/types/api';

interface InfiniteVideoGridProps {
  initialVideos: Video[];
  initialTotal: number;
  filters: Omit<VideoFilters, 'page'>;
}

export function InfiniteVideoGrid({
  initialVideos,
  initialTotal,
  filters,
}: InfiniteVideoGridProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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
    limit: 16,
    enabled: true,
  });

  // Use initial videos while loading the first query result
  const displayVideos = videos.length > 0 ? videos : initialVideos;
  const displayTotal = totalCount > 0 ? totalCount : initialTotal;

  // Check if there are any active filters
  const hasFilters = !!(
    filters.bandId ||
    filters.category ||
    filters.year ||
    filters.search
  );

  if (isEmpty && !isLoading) {
    return <EmptyVideosState hasFilters={hasFilters} />;
  }

  return (
    <div>
      {/* Results count */}
      <p className="text-sm text-gray-600 mb-4">
        Showing {displayVideos.length.toLocaleString()} of{' '}
        {displayTotal.toLocaleString()} videos
      </p>

      {/* Video grid */}
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
    </div>
  );
}
