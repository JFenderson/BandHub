import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { Video } from '@/types/api';
import { VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  // Check if video was added to database within the last 7 days
  const isRecentlyAdded = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(video.createdAt) > sevenDaysAgo;
  };

  return (
    <div className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Video Link Wrapper */}
      <Link href={`/videos/${video.id}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-900">
          <Image
            src={video.thumbnailUrl || '/placeholder-video.jpg'}
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
              {VIDEO_CATEGORY_LABELS[video.category]}
            </div>
          )}

          {/* Recently Added Badge */}
          {isRecentlyAdded() && (
            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold">
              NEW
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
          {video.creator && (
            <>
              <Link 
                href={`/creators/${video.creator.id}`}
                className="font-medium hover:text-primary-600 transition-colors"
              >
                {video.creator.name}
              </Link>
              {video.band && <span>•</span>}
            </>
          )}
          {video.band && (
            <>
              <Link 
                href={`/bands/${video.band.slug}`}
                className="font-medium hover:text-primary-600 transition-colors"
              >
                {video.band.name}
              </Link>
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
    </div>
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