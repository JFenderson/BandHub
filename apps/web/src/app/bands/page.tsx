import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { BandCard } from '@/components/bands/BandCard';
import { BandFilters } from '@/components/bands/BandFilters';
import { Pagination } from '@/components/ui/Pagination';

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
  const limit = 12;

  let bands: Awaited<ReturnType<typeof apiClient.getBands>>['data'] = [];
  let meta = { total: 0, page: 1, totalPages: 1 };
  try {
    const result = await apiClient.getBands({ search, state, conference, page, limit });
    bands = result.data;
    meta = result.meta;
  } catch (error) {
    console.error('Failed to fetch bands:', error);
  }

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">HBCU Bands</h1>
        <p className="text-lg text-gray-600">
          Explore {meta.total} Historically Black College and University marching bands
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="h-16 bg-gray-100 rounded-lg animate-pulse" />}>
        <BandFilters />
      </Suspense>

      {/* Results */}
      <div className="mt-8">
        {bands.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {bands.map((band) => (
                <BandCard key={band.id} band={band} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              baseUrl="/bands"
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
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No bands found</h3>
            <p className="mt-2 text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}