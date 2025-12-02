import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { CreatorCard } from '@/components/creators/CreatorCard';
import { Pagination } from '@/components/ui/Pagination';

interface CreatorsPageProps {
  searchParams: {
    search?: string;
    page?: string;
  };
}

export default async function CreatorsPage({ searchParams }: CreatorsPageProps) {
  const page = parseInt(searchParams.page || '1');
  const limit = 50;

  const { data: creators, meta } = await apiClient.getCreators({
    search: searchParams.search,
    isVerified: true,
    page,
    limit,
  });

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Content Creators</h1>
        <p className="text-lg text-gray-600">
          Discover {meta.total} content creators documenting HBCU band culture
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <form className="max-w-md">
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={searchParams.search}
              placeholder="Search creators..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="mt-8">
        {creators.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              baseUrl="/creators"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No creators found</h3>
            <p className="mt-2 text-gray-500">
              {searchParams.search
                ? 'Try adjusting your search criteria'
                : 'Check back later for content creators'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
