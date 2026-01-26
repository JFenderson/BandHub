import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { VideoFilters } from '@/components/videos/VideoFilters';
import { InfiniteVideoGrid } from '@/components/videos/InfiniteVideoGrid';
import type { VideoCategory } from '@/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface VideosPageProps {
  searchParams: {
    search?: string;
    bandId?: string;
    conference?: string;
    category?: VideoCategory;
    eventYear?: string;
    sortBy?: 'publishedAt' | 'viewCount' | 'title';
    sortOrder?: 'asc' | 'desc';
  };
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const limit = 16;

  // Fetch initial page of videos for SSR
  const { data: videos, meta } = await apiClient.getVideos({
    search: searchParams.search,
    bandId: searchParams.bandId,
    conference: searchParams.conference,
    category: searchParams.category,
    year: searchParams.eventYear ? parseInt(searchParams.eventYear) : undefined,
    sortBy: searchParams.sortBy || 'publishedAt',
    sortOrder: searchParams.sortOrder || 'desc',
    page: 1,
    limit,
  });

  // Fetch bands for filter dropdown
  const { data: bands } = await apiClient.getBands({ limit: 100 });

  // Build filters object for the infinite scroll component
  const filters = {
    search: searchParams.search,
    bandId: searchParams.bandId,
    conference: searchParams.conference,
    category: searchParams.category,
    year: searchParams.eventYear ? parseInt(searchParams.eventYear) : undefined,
    sortBy: searchParams.sortBy || 'publishedAt',
    sortOrder: searchParams.sortOrder || 'desc',
  };

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Video Library</h1>
        <p className="text-lg text-gray-600">
          Browse {meta.total.toLocaleString()} performances from HBCU marching bands
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<FiltersSkeleton />}>
        <VideoFilters bands={bands} />
      </Suspense>

      {/* Sort Dropdown */}
      <div className="flex items-center justify-end mt-8 mb-4">
        <SortDropdown />
      </div>

      {/* Video Grid with Infinite Scroll */}
      <div className="mt-6">
        <InfiniteVideoGrid
          initialVideos={videos}
          initialTotal={meta.total}
          filters={filters}
        />
      </div>
    </div>
  );
}

// Skeleton loader for filters
function FiltersSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Sort dropdown component
function SortDropdown() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="sort" className="text-gray-600">Sort by:</label>
      <select
        id="sort"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="publishedAt-desc">Newest First</option>
        <option value="publishedAt-asc">Oldest First</option>
        <option value="viewCount-desc">Most Viewed</option>
        <option value="title-asc">Title A-Z</option>
        <option value="title-desc">Title Z-A</option>
      </select>
    </div>
  );
}
