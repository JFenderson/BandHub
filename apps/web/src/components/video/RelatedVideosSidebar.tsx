'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { VideoThumbnail } from '@/components/images';
import { apiClient } from '@/lib/api-client';
import type { RelatedVideo, RelatedVideosResponse, BecauseYouWatchedSection } from '@/types/api';

interface RelatedVideosSidebarProps {
  videoId: string;
}

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

function RelatedVideoCard({ video }: { video: RelatedVideo }) {
  return (
    <Link href={`/videos/${video.id}`} className="group flex gap-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors">
      <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-gray-900">
        <VideoThumbnail
          src={video.thumbnailUrl}
          alt={video.title}
          className="object-cover group-hover:opacity-90 transition-opacity"
          width={160}
          height={90}
        />
        {video.duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-gray-900 group-hover:text-primary-600 line-clamp-2 transition-colors">
          {video.title}
        </h4>
        <p className="text-xs text-gray-600 mt-1 truncate">
          {video.band.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <span>{formatViewCount(video.viewCount)} views</span>
          <span>-</span>
          <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
        </div>
        {video.matchReason && (
          <span className="inline-block text-xs text-primary-600 mt-1.5 bg-primary-50 px-2 py-0.5 rounded-full">
            {video.matchReason}
          </span>
        )}
      </div>
    </Link>
  );
}

function BecauseYouWatchedCard({ section }: { section: BecauseYouWatchedSection }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-200">
          <VideoThumbnail
            src={section.sourceVideo.thumbnailUrl}
            alt={section.sourceVideo.title}
            className="object-cover"
            width={32}
            height={32}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Because you watched</p>
          <p className="text-sm font-medium text-gray-900 truncate">{section.sourceVideo.title}</p>
        </div>
      </div>
      <div className="space-y-3">
        {section.videos.map((video) => (
          <RelatedVideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-40 aspect-video bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelatedVideosSidebar({ videoId }: RelatedVideosSidebarProps) {
  const [data, setData] = useState<RelatedVideosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRelatedVideos() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getRelatedVideos(videoId, 10);
        setData(response);
      } catch (err) {
        console.error('Failed to fetch related videos:', err);
        setError('Failed to load related videos');
      } finally {
        setLoading(false);
      }
    }

    fetchRelatedVideos();
  }, [videoId]);

  if (loading) {
    return (
      <div className="lg:col-span-1">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Related Videos</h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="lg:col-span-1">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Related Videos</h3>
        <p className="text-sm text-gray-500">{error || 'No related videos found'}</p>
      </div>
    );
  }

  const hasBecauseYouWatched = data.becauseYouWatched && data.becauseYouWatched.length > 0;
  const hasRelatedVideos = data.videos && data.videos.length > 0;

  if (!hasBecauseYouWatched && !hasRelatedVideos) {
    return (
      <div className="lg:col-span-1">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Related Videos</h3>
        <p className="text-sm text-gray-500">No related videos found</p>
      </div>
    );
  }

  return (
    <div className="lg:col-span-1">
      {/* Because You Watched Sections */}
      {hasBecauseYouWatched && (
        <div className="mb-6">
          {data.becauseYouWatched!.map((section, index) => (
            <BecauseYouWatchedCard key={`${section.sourceVideo.id}-${index}`} section={section} />
          ))}
        </div>
      )}

      {/* Related Videos Section */}
      {hasRelatedVideos && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Discover Similar Bands
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Videos from other bands with similar content
          </p>
          {data.fallbackReason && (
            <p className="text-xs text-gray-500 mb-3">{data.fallbackReason}</p>
          )}
          <div className="space-y-3">
            {data.videos.map((video) => (
              <RelatedVideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
