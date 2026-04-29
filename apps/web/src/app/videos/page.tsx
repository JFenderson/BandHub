import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
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

type Section = 'hbcu' | 'high-school';

interface VideosPageProps {
  searchParams: Promise<{
    search?: string;
    bandId?: string;
    conference?: string;
    category?: VideoCategory;
    eventYear?: string;
    sortBy?: 'publishedAt' | 'viewCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    section?: Section;
  }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { search, bandId, conference, category, eventYear, sortBy, sortOrder, section = 'hbcu' } = await searchParams;
  const limit = 16;
  const isHighSchool = section === 'high-school';

  // Build section-specific API filters
  const sectionFilter = isHighSchool
    ? { categorySlug: 'high-school' }
    : {};

  let videos: Awaited<ReturnType<typeof apiClient.getVideos>>['data'] = [];
  let meta = { total: 0, page: 1, totalPages: 1 };
  try {
    const result = await apiClient.getVideos({
      search,
      bandId: isHighSchool ? undefined : bandId,
      conference: isHighSchool ? undefined : conference,
      category: isHighSchool ? undefined : category,
      year: eventYear ? parseInt(eventYear) : undefined,
      sortBy: sortBy || 'publishedAt',
      sortOrder: sortOrder || 'desc',
      page: 1,
      limit,
      ...sectionFilter,
    });
    videos = result.data;
    meta = result.meta;
  } catch (error) {
    console.error('Failed to fetch videos:', error);
  }

  // Fetch bands for filter dropdown (only for HBCU section)
  let bands: { id: string; name: string }[] = [];
  if (!isHighSchool) {
    try {
      bands = await apiClient.getBandsForDropdown();
    } catch (error) {
      console.error('Failed to fetch bands for filter:', error);
    }
  }

  const filters = {
    search,
    bandId: isHighSchool ? undefined : bandId,
    conference: isHighSchool ? undefined : conference,
    category: isHighSchool ? undefined : category,
    year: eventYear ? parseInt(eventYear) : undefined,
    sortBy: sortBy || 'publishedAt',
    sortOrder: sortOrder || 'desc',
    ...sectionFilter,
  };

  const pageTitle = isHighSchool ? 'High School Bands' : 'Video Library';
  const pageDescription = isHighSchool
    ? `Browse ${meta.total.toLocaleString()} high school marching band performances`
    : `Browse ${meta.total.toLocaleString()} performances from HBCU marching bands`;

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
        <p className="text-lg text-gray-600">{pageDescription}</p>
      </div>

      {/* Section Tabs */}
      <SectionTabs activeSection={section} />

      {/* Filters */}
      <div className="mt-6">
        <Suspense fallback={<FiltersSkeleton />}>
          <VideoFilters bands={isHighSchool ? [] : bands} section={section} />
        </Suspense>
      </div>

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

// Section tabs component
function SectionTabs({ activeSection }: { activeSection: Section }) {
  const tabs: { label: string; value: Section; description: string }[] = [
    { label: 'HBCU Bands', value: 'hbcu', description: 'Historically Black College & University marching bands' },
    { label: 'High School', value: 'high-school', description: 'High school marching band performances' },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-6" aria-label="Video sections">
        {tabs.map((tab) => {
          const isActive = activeSection === tab.value;
          const href = tab.value === 'hbcu' ? '/videos' : `/videos?section=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`
                group inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-semibold transition-colors
                ${isActive
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
              `}
              aria-current={isActive ? 'page' : undefined}
              title={tab.description}
            >
              {tab.value === 'hbcu' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              )}
              {tab.value === 'high-school' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              )}
              {tab.label}
            </Link>
          );
        })}
      </nav>
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
