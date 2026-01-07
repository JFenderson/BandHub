import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { VideoCard } from '@/components/videos/VideoCard';
import { VideoFilters } from '@/components/videos/VideoFilters';
import { Pagination } from '@/components/ui/Pagination';
import type { VideoCategory } from '@/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface VideosPageProps {
  searchParams: {
    search?: string;
    bandId?: string;
    category?: VideoCategory;
    eventYear?: string;  // ← CHANGED from 'year' to 'eventYear'
    sortBy?: 'publishedAt' | 'viewCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    page?: string;
  };
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const page = parseInt(searchParams.page || '1');
  const limit = 16;

  const { data: videos, meta } = await apiClient.getVideos({
    search: searchParams.search,
    bandId: searchParams.bandId,
    category: searchParams.category,
    year: searchParams.eventYear ? parseInt(searchParams.eventYear) : undefined,  // ← CHANGED from searchParams.year
    sortBy: searchParams.sortBy || 'publishedAt',
    sortOrder: searchParams.sortOrder || 'desc',
    page,
    limit,
  });

  // Fetch bands for filter dropdown
  const { data: bands } = await apiClient.getBands({ limit: 100 });

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

      {/* Results Count and Sort */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <p className="text-sm text-gray-600">
          Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total.toLocaleString()} videos
        </p>
        
        <SortDropdown />
      </div>

      {/* Video Grid */}
      <div className="mt-6">
        {videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              baseUrl="/videos"
            />
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
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