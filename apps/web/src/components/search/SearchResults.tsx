'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';
import type { ViewMode } from './ViewToggle';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string | Date;
  viewCount: number;
  youtubeId: string;
  highlights?: {
    title?: string;
    description?: string;
    bandName?: string;
  };
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  opponentBand?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface SearchResultsProps {
  results: SearchResult[];
  view: ViewMode;
  query?: string;
  isLoading?: boolean;
}

export function SearchResults({ results, view, query, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return <LoadingSkeleton view={view} />;
  }

  if (results.length === 0) {
    return <EmptyState query={query} />;
  }

  if (view === 'grid') {
    return <GridView results={results} />;
  }

  if (view === 'list') {
    return <ListView results={results} />;
  }

  return <CompactView results={results} />;
}

function GridView({ results }: { results: SearchResult[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {results.map((video) => (
        <Link
          key={video.id}
          href={`/videos/${video.id}`}
          className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow border border-gray-100"
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-gray-900">
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover group-hover:opacity-90 transition-opacity"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
            {/* Category Badge */}
            {video.category && (
              <div className="absolute top-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                {VIDEO_CATEGORY_LABELS[video.category.slug as keyof typeof VIDEO_CATEGORY_LABELS] || video.category.name}
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="p-3">
            <h3
              className="font-semibold text-sm text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mb-1"
              dangerouslySetInnerHTML={{
                __html: video.highlights?.title || video.title,
              }}
            />
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span
                className="font-medium hover:text-primary-600"
                dangerouslySetInnerHTML={{
                  __html: video.highlights?.bandName || video.band.name,
                }}
              />
              <span>•</span>
              <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatViewCount(video.viewCount)} views
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ListView({ results }: { results: SearchResult[] }) {
  return (
    <div className="space-y-4">
      {results.map((video) => (
        <Link
          key={video.id}
          href={`/videos/${video.id}`}
          className="group flex gap-4 bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-100 p-4"
        >
          {/* Thumbnail */}
          <div className="relative flex-shrink-0 w-64 aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover group-hover:opacity-90 transition-opacity"
              sizes="256px"
            />
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
          </div>

          {/* Video Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {video.category && (
                <span className="flex-shrink-0 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                  {VIDEO_CATEGORY_LABELS[video.category.slug as keyof typeof VIDEO_CATEGORY_LABELS] || video.category.name}
                </span>
              )}
            </div>
            <h3
              className="font-semibold text-lg text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mt-1"
              dangerouslySetInnerHTML={{
                __html: video.highlights?.title || video.title,
              }}
            />
            {video.description && (
              <p
                className="text-sm text-gray-600 mt-2 line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: video.highlights?.description || video.description,
                }}
              />
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span
                className="font-medium text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: video.highlights?.bandName || video.band.name,
                }}
              />
              <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
              <span>{formatViewCount(video.viewCount)} views</span>
            </div>
            {video.opponentBand && (
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>vs</span>
                <span className="font-medium">{video.opponentBand.name}</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function CompactView({ results }: { results: SearchResult[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Video
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
              Band
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
              Category
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Views
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {results.map((video) => (
            <tr key={video.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/videos/${video.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="relative flex-shrink-0 w-16 h-10 bg-gray-900 rounded overflow-hidden">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <span
                    className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                    dangerouslySetInnerHTML={{
                      __html: video.highlights?.title || video.title,
                    }}
                  />
                </Link>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <Link
                  href={`/bands/${video.band.slug}`}
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  {video.band.name}
                </Link>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {video.category && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {VIDEO_CATEGORY_LABELS[video.category.slug as keyof typeof VIDEO_CATEGORY_LABELS] || video.category.name}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                {formatDuration(video.duration)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                {formatViewCount(video.viewCount)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingSkeleton({ view }: { view: ViewMode }) {
  const skeletonCount = view === 'grid' ? 8 : 5;

  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(skeletonCount)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg overflow-hidden border border-gray-100">
            <div className="aspect-video bg-gray-200 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="space-y-4">
        {[...Array(skeletonCount)].map((_, i) => (
          <div key={i} className="flex gap-4 bg-white rounded-lg border border-gray-100 p-4">
            <div className="flex-shrink-0 w-64 aspect-video bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></th>
            <th className="px-4 py-3 text-left hidden md:table-cell"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></th>
            <th className="px-4 py-3 text-left hidden lg:table-cell"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></th>
            <th className="px-4 py-3 text-left hidden sm:table-cell"><div className="h-4 w-14 bg-gray-200 rounded animate-pulse" /></th>
            <th className="px-4 py-3 text-left hidden sm:table-cell"><div className="h-4 w-10 bg-gray-200 rounded animate-pulse" /></th>
            <th className="px-4 py-3 text-left hidden lg:table-cell"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {[...Array(skeletonCount)].map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
              <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
              <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 bg-gray-200 rounded w-12 animate-pulse" /></td>
              <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 bg-gray-200 rounded w-10 animate-pulse" /></td>
              <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
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
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        {query ? 'No results found' : 'Start searching'}
      </h3>
      {query ? (
        <>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            No videos found for &quot;{query}&quot;. Try adjusting your search or filters.
          </p>
          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Search tips:</p>
            <ul className="space-y-1 text-left max-w-xs mx-auto">
              <li>• Check your spelling</li>
              <li>• Try different keywords</li>
              <li>• Use fewer or broader terms</li>
              <li>• Remove some filters</li>
            </ul>
          </div>
          <div className="mt-8">
            <Link
              href="/bands"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Browse all bands
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-2 text-gray-500">
          Enter a search term to find videos, bands, and events.
        </p>
      )}
    </div>
  );
}

// Helper functions
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
