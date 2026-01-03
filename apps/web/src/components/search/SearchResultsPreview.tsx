'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Play, Clock, Eye, Calendar } from 'lucide-react';
import { VideoSearchResult } from '@/types/search';

interface SearchResultsPreviewProps {
  results: VideoSearchResult[];
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export function SearchResultsPreview({
  results,
  isLoading,
  error,
  onRetry,
  className = '',
}: SearchResultsPreviewProps) {
  /**
   * Format duration (PT1H2M3S -> 1:02:03)
   */
  const formatDuration = (duration: string): string => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Format view count
   */
  const formatViews = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return date.toLocaleDateString();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse flex gap-4">
            <div className="w-48 h-28 bg-gray-200 rounded-lg flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              <div className="h-4 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="max-w-md mx-auto">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Search Error
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  if (results.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No videos found
        </h3>
        <p className="text-gray-600">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  // Results
  return (
    <div className={`space-y-4 ${className}`}>
      {results.map((video) => (
        <article
          key={video.id}
          className="group flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          {/* Thumbnail */}
          <Link
            href={`/videos/${video.youtubeId}`}
            className="relative flex-shrink-0 w-48 h-28 bg-gray-100 rounded-lg overflow-hidden"
          >
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 192px, 192px"
            />
            
            {/* Duration overlay */}
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white 
                          text-xs font-medium rounded">
              {formatDuration(video.duration)}
            </div>

            {/* Play overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 
                          transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white fill-white" />
              </div>
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Link href={`/videos/${video.youtubeId}`}>
              <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600
                           transition-colors mb-1">
                {video.title}
              </h3>
            </Link>

            {/* Band info */}
            <Link
              href={`/bands/${video.band.id}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 
                       hover:text-blue-600 transition-colors mb-2"
            >
              {video.band.logoUrl && (
                <Image
                  src={video.band.logoUrl}
                  alt={video.band.name}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              <span className="font-medium">
                {video.band.name}
                {video.band.nickname && ` (${video.band.nickname})`}
              </span>
            </Link>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViews(video.viewCount)} views
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(video.publishedAt)}
              </span>
              {video.event && (
                <span className="flex items-center gap-1">
                  📍 {video.event.name}
                </span>
              )}
            </div>

            {/* Categories */}
            {video.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {video.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/videos?categories=${category.id}`}
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full
                             hover:bg-blue-100 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Opponent band */}
            {video.opponentBand && (
              <div className="text-xs text-gray-500 mt-1">
                vs {video.opponentBand.name}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}