import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { BandFilters } from '@/components/bands/BandFilters';
import { BandGrid } from '@/components/bands/BandGrid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BandsPageProps {
  searchParams: Promise<{
    search?: string;
    state?: string;
    conference?: string;
    page?: string;
  }>;
}

export default async function BandsPage({ searchParams }: BandsPageProps) {
  const { search, state, conference, page: pageParam } = await searchParams;
  const page = parseInt(pageParam || '1');

  let initialBands: Awaited<ReturnType<typeof apiClient.getBands>>['data'] = [];
  let initialMeta = { total: 0, page: 1, totalPages: 1 };
  try {
    const result = await apiClient.getBands({ search, state, conference, page, limit: 12 });
    initialBands = result.data;
    initialMeta = result.meta;
  } catch (error) {
    console.error('Failed to fetch bands:', error);
  }

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">HBCU Bands</h1>
        <p className="text-lg text-gray-600">
          Explore Historically Black College and University marching bands
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="h-16 bg-gray-100 rounded-lg animate-pulse" />}>
        <BandFilters />
      </Suspense>

      {/* Results — client component handles fetching with filter changes */}
      <div className="mt-8">
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        }>
          <BandGrid initialBands={initialBands} initialMeta={initialMeta} />
        </Suspense>
      </div>
    </div>
  );
}