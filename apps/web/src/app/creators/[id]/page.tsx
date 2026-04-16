import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { VideoCard } from '@/components/videos/VideoCard';
import { Pagination } from '@/components/ui/Pagination';
import { CreatorVideoFilters } from '@/components/creators/CreatorVideoFilters';

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic';

interface CreatorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    bandId?: string;
    category?: string;
    year?: string;
    search?: string;
    sortBy?: string;
  }>;
}

export default async function CreatorPage({ params, searchParams }: CreatorPageProps) {
  const { id } = await params;
  const { page: pageParam, bandId, category, year, search, sortBy } = await searchParams;
  const page = parseInt(pageParam || '1');
  const limit = 12;

  let creator: Awaited<ReturnType<typeof apiClient.getCreator>>;
  let videosResult: Awaited<ReturnType<typeof apiClient.getCreatorVideos>>;
  let bands: { id: string; name: string }[] = [];

  try {
    [creator, videosResult] = await Promise.all([
      apiClient.getCreator(id),
      apiClient.getCreatorVideos(id, {
        page,
        limit,
        bandId,
        category: category as any,
        year: year ? parseInt(year) : undefined,
        search,
        sortBy: (sortBy as 'publishedAt' | 'viewCount' | 'title') || 'publishedAt',
        sortOrder: 'desc',
      }),
    ]);
  } catch {
    notFound();
  }

  try {
    bands = await apiClient.getBandsForDropdown();
  } catch {
    // non-fatal — filters still render without band list
  }

  const videos = videosResult.data;
  const videoCount = creator._count?.videos ?? creator.videosInOurDb ?? 0;

  const hasActiveFilters = !!(bandId || category || year || search || (sortBy && sortBy !== 'publishedAt'));

  return (
    <div className="bg-white">
      {/* Creator Header */}
      <div className="bg-gradient-to-br from-primary-600 to-secondary-700 text-white">
        <div className="container-custom py-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Logo */}
            <div className="w-32 h-32 rounded-lg bg-white overflow-hidden flex-shrink-0">
              {creator.logoUrl || creator.thumbnailUrl ? (
                <Image
                  src={creator.logoUrl || creator.thumbnailUrl || ''}
                  alt={creator.name}
                  width={128}
                  height={128}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-100">
                  <span className="text-4xl font-bold text-primary-600">
                    {creator.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Creator Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{creator.name}</h1>
                {creator.isVerified && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
                {creator.isFeatured && (
                  <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Featured</span>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {creator.channelUrl && (
                  <a
                    href={creator.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>YouTube Channel</span>
                  </a>
                )}
              </div>

              {creator.description && (
                <p className="mt-6 text-primary-50 leading-relaxed max-w-3xl">{creator.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b bg-gray-50">
        <div className="container-custom py-6">
          <div className="flex gap-8">
            <div>
              <div className="text-2xl font-bold text-gray-900">{videoCount}</div>
              <div className="text-sm text-gray-600">Videos in Database</div>
            </div>
            {creator.subscriberCount > 0 && (
              <div>
                <div className="text-2xl font-bold text-gray-900">{formatNumber(creator.subscriberCount)}</div>
                <div className="text-sm text-gray-600">Subscribers</div>
              </div>
            )}
            {creator.qualityScore > 0 && (
              <div>
                <div className="text-2xl font-bold text-gray-900">{creator.qualityScore}</div>
                <div className="text-sm text-gray-600">Quality Score</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Videos Section */}
      <div className="container-custom py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Videos
            {videosResult.meta.total > 0 && (
              <span className="ml-2 text-lg font-normal text-gray-500">
                ({hasActiveFilters ? `${videosResult.meta.total} filtered` : videosResult.meta.total})
              </span>
            )}
          </h2>
        </div>

        {/* Filters */}
        <Suspense fallback={<FilterSkeleton />}>
          <CreatorVideoFilters creatorId={id} bands={bands} />
        </Suspense>

        {/* Results */}
        {videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>

            <Pagination
              currentPage={videosResult.meta.page}
              totalPages={videosResult.meta.totalPages}
              baseUrl={`/creators/${id}`}
            />
          </>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            {hasActiveFilters ? (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No videos match your filters</h3>
                <p className="text-gray-500 mb-4">Try adjusting or clearing your filters.</p>
                <Link
                  href={`/creators/${id}`}
                  className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                >
                  Clear all filters
                </Link>
              </>
            ) : (
              <p className="text-gray-500">No videos available from this creator yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
