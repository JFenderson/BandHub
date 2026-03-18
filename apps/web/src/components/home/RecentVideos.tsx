'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { VideoCard } from '@/components/videos/VideoCard';
import { TrendingVideoCard } from '@/components/videos/TrendingVideoCard';
import type { Video, TrendingVideo } from '@/types/api';

interface RecentVideosProps {
  initialRecentlyAdded: Video[];
  initialTrending: TrendingVideo[];
}

export function RecentVideos({ initialRecentlyAdded, initialTrending }: RecentVideosProps) {
  const [recentlyAdded, setRecentlyAdded] = useState<Video[]>(initialRecentlyAdded);
  const [trending, setTrending] = useState<TrendingVideo[]>(initialTrending);

  useEffect(() => {
    // Only fetch client-side if SSR returned empty results
    if (initialRecentlyAdded.length === 0) {
      apiClient
        .getVideos({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' })
        .then((r) => setRecentlyAdded(r.data))
        .catch(() => {});
    }
    if (initialTrending.length === 0) {
      apiClient
        .getTrendingVideos({ timeframe: 'week', limit: 8 })
        .then((data) => setTrending(data))
        .catch(() => {});
    }
  }, [initialRecentlyAdded.length, initialTrending.length]);

  return (
    <>
      {trending.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-orange-50 to-red-50">
          <div className="container-custom">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔥</span>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Trending This Week</h2>
                  <p className="text-gray-600 mt-1">The hottest performances right now</p>
                </div>
              </div>
              <Link
                href="/videos?sortBy=viewCount"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trending.map((video, index) => (
                <TrendingVideoCard key={video.id} video={video} rank={index + 1} />
              ))}
            </div>
          </div>
        </section>
      )}

      {recentlyAdded.length > 0 && (
        <div className="container-custom mt-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Recently Added to BandHub</h2>
              <p className="text-gray-600 mt-2">New videos added to our platform</p>
            </div>
            <Link
              href="/videos?sortBy=createdAt"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyAdded.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
