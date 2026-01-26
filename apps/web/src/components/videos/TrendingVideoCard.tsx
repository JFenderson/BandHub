import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { TrendingVideo } from '@/types/api';
import { VideoThumbnail } from '@/components/images';

interface TrendingVideoCardProps {
  video: TrendingVideo;
  rank?: number;
}

export function TrendingVideoCard({ video, rank }: TrendingVideoCardProps) {
  return (
    <div className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative">
      {/* Rank Badge */}
      {rank && rank <= 3 && (
        <div className="absolute -top-1 -left-1 z-20 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">#{rank}</span>
        </div>
      )}

      {/* Video Link Wrapper */}
      <Link href={`/videos/${video.id}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-900">
          <VideoThumbnail
            src={video.thumbnailUrl}
            alt={video.title}
            className="object-cover group-hover:opacity-90 transition-opacity"
            width={480}
            height={270}
          />

          {/* Duration Badge - bottom-right */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
          )}

          {/* Trending Badge - top-left with fire emoji */}
          <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded font-semibold flex items-center gap-1 shadow-lg">
            <span className="text-sm">🔥</span>
            <span>Trending</span>
          </div>

          {/* Category Badge - top-right if category exists */}
          {video.category && (
            <div className="absolute top-2 right-2 bg-primary-600/90 text-white text-xs px-2 py-1 rounded">
              {video.category.name}
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-3">
          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mb-1">
            {video.title}
          </h3>
        </div>
      </Link>

      {/* Meta Info with clickable links */}
      <div className="px-3 pb-3">
        <div className="flex items-center flex-wrap gap-1 text-xs text-gray-600">
          <Link
            href={`/bands/${video.band.slug}`}
            className="font-medium hover:text-primary-600 transition-colors"
          >
            {video.band.name}
          </Link>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="text-xs text-gray-500">
            {formatViewCount(video.viewCount)} views
          </div>
          {/* Trending score indicator */}
          <div className="flex items-center gap-1 text-xs text-orange-600">
            <TrendingIcon />
            <span>{video.trendingScore.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Trending icon component
function TrendingIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Helper function to format duration from seconds
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to format view count
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
