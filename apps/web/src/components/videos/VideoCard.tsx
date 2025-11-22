import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { Video } from '@/types/api';

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
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
        
        {/* Duration Badge - convert seconds to MM:SS */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Category Badge */}
        {video.category && (
          <div className="absolute top-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
            {video.category.name}
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mb-1">
          {video.title}
        </h3>
        
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {video.band && (
            <>
              <span className="font-medium hover:text-primary-600">
                {video.band.name}
              </span>
              <span>•</span>
            </>
          )}
          <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
        </div>

        {video.viewCount != null && (
          <div className="text-xs text-gray-500 mt-1">
            {formatViewCount(video.viewCount)} views
          </div>
        )}
      </div>
    </Link>
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