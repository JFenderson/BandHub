import { Suspense } from 'react';
import type { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';
import { VideoFilters } from '@/components/videos/VideoFilters';
import { InfiniteVideoGrid } from '@/components/videos/InfiniteVideoGrid';
import type { VideoCategory } from '@/types/api';

export const metadata: Metadata = {
  title: 'Videos - HBCU Marching Band Performances | BandHub',
  description: 'Browse thousands of HBCU marching band performances. Filter by band, category, and year to find your favorite shows.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface VideosPageProps {
  searchParams: Promise<{
    search?: string;
    bandId?: string;
    conference?: string;
    category?: VideoCategory;
    eventYear?: string;
    sortBy?: 'publishedAt' | 'viewCount' | 'title';
    sortOrder?: 'asc' | 'desc';
  }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { search, bandId, conference, category, eventYear, sortBy, sortOrder } = await searchParams;
  const limit = 16;

  // Fetch initial page of videos for SSR
  let videos: Awaited<ReturnType<typeof apiClient.getVideos>>['data'] = [];
  let meta = { total: 0, page: 1, totalPages: 1 };
  try {
    const result = await apiClient.getVideos({
      search,
      bandId,
      conference,
      category,
      year: eventYear ? parseInt(eventYear) : undefined,
      sortBy: sortBy || 'publishedAt',
      sortOrder: sortOrder || 'desc',
      page: 1,
      limit,
    });
    videos = result.data;
    meta = result.meta;
  } catch (error) {
    console.error('Failed to fetch videos:', error);
  }

  // Fetch bands for filter dropdown (unpaginated endpoint, returns all HBCU bands)
  let bands: { id: string; name: string }[] = [];
  try {
    bands = await apiClient.getBandsForDropdown();
  } catch (error) {
    console.error('Failed to fetch bands for filter:', error);
  }

  // Build filters object for the infinite scroll component
  const filters = {
    search,
    bandId,
    conference,
    category,
    year: eventYear ? parseInt(eventYear) : undefined,
    sortBy: sortBy || 'publishedAt',
    sortOrder: sortOrder || 'desc',
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
    <div
      className="bg-white rounded-lg border border-gray-200 p-4"
      role="status"
      aria-label="Loading video filters"
    >
      <span className="sr-only">Loading video filters...</span>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
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
