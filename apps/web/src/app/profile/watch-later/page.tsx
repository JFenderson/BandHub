'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { favoritesApiClient, type WatchLaterItem, type WatchLaterResponse } from '@/lib/api/favorites';
import { getAuthTokens } from '@/lib/utils/cookies';

type FilterType = 'all' | 'unwatched' | 'watched';

export default function WatchLaterPage() {
  return (
    <ProtectedRoute>
      <WatchLaterContent />
    </ProtectedRoute>
  );
}

function WatchLaterContent() {
  const [watchLater, setWatchLater] = useState<WatchLaterItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, watched: 0, unwatched: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<'recentlyAdded' | 'oldest'>('recentlyAdded');

  // Set up token provider
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  const fetchWatchLater = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await favoritesApiClient.getWatchLaterList({ page, filter, sortBy });
      setWatchLater(response.data);
      setMeta(response.meta);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to fetch watch later:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, sortBy]);

  useEffect(() => {
    fetchWatchLater();
  }, [fetchWatchLater]);

  const handleToggleWatched = useCallback(async (videoId: string, watched: boolean) => {
    try {
      await favoritesApiClient.markAsWatched(videoId, watched);
      setWatchLater(prev => 
        prev.map(item => item.videoId === videoId ? { ...item, watched, watchedAt: watched ? new Date().toISOString() : undefined } : item)
      );
      setStats(prev => ({
        ...prev,
        watched: watched ? prev.watched + 1 : prev.watched - 1,
        unwatched: watched ? prev.unwatched - 1 : prev.unwatched + 1,
      }));
    } catch (error) {
      console.error('Failed to update watch status:', error);
    }
  }, []);

  const handleRemove = useCallback(async (videoId: string) => {
    try {
      const item = watchLater.find(w => w.videoId === videoId);
      await favoritesApiClient.removeFromWatchLater(videoId);
      setWatchLater(prev => prev.filter(w => w.videoId !== videoId));
      setMeta(prev => ({ ...prev, total: prev.total - 1 }));
      setStats(prev => ({
        total: prev.total - 1,
        watched: item?.watched ? prev.watched - 1 : prev.watched,
        unwatched: item?.watched ? prev.unwatched : prev.unwatched - 1,
      }));
    } catch (error) {
      console.error('Failed to remove from watch later:', error);
    }
  }, [watchLater]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.watched / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Watch Later</h1>
          <p className="text-gray-600 mt-1">{stats.total} videos saved</p>

          {/* Progress Bar */}
          {stats.total > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>{stats.watched} watched</span>
                <span>{stats.unwatched} to go</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">{progressPercent}% complete</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['all', 'unwatched', 'watched'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="recentlyAdded">Recently Added</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="flex space-x-4">
                  <div className="w-40 h-24 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : watchLater.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No videos saved' : `No ${filter} videos`}
            </h2>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? 'Save videos to watch later!' 
                : filter === 'unwatched' 
                  ? 'All caught up! No unwatched videos.' 
                  : 'Watch some videos and mark them as watched!'}
            </p>
            <Link
              href="/videos"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Browse Videos
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {watchLater.map((item) => (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                    item.watched ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex">
                    {/* Checkbox */}
                    <div className="flex items-center px-4">
                      <input
                        type="checkbox"
                        checked={item.watched}
                        onChange={(e) => handleToggleWatched(item.videoId, e.target.checked)}
                        className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                      />
                    </div>

                    {/* Thumbnail */}
                    <Link href={`/videos/${item.video.id}`} className="relative w-40 h-24 flex-shrink-0">
                      <Image
                        src={item.video.thumbnailUrl}
                        alt={item.video.title}
                        fill
                        className={`object-cover ${item.watched ? 'grayscale' : ''}`}
                        sizes="160px"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                        {formatDuration(item.video.duration)}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 p-4">
                      <Link href={`/videos/${item.video.id}`}>
                        <h3 className={`font-semibold hover:text-primary-600 transition-colors ${
                          item.watched ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}>
                          {item.video.title}
                        </h3>
                      </Link>
                      
                      <div className="flex items-center mt-1 text-sm text-gray-600">
                        <Link href={`/bands/${item.video.band.slug}`} className="hover:text-primary-600">
                          {item.video.band.name}
                        </Link>
                        <span className="mx-2">•</span>
                        <span>{item.video.viewCount.toLocaleString()} views</span>
                      </div>
                      
                      <div className="text-xs text-gray-400 mt-1">
                        Added {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        {item.watchedAt && (
                          <> • Watched {formatDistanceToNow(new Date(item.watchedAt), { addSuffix: true })}</>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center px-4">
                      <button
                        onClick={() => handleRemove(item.videoId)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100"
                        title="Remove from list"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex justify-center mt-8 space-x-2">
                <button
                  onClick={() => fetchWatchLater(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => fetchWatchLater(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
