'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { apiClient } from '@/lib/api-client';
import { getAuthTokens } from '@/lib/utils/cookies';
import type { WatchHistoryEntry, WatchHistoryFilter, WatchHistorySortBy, WatchStats } from '@/types/api';

export default function WatchHistoryPage() {
  return (
    <ProtectedRoute>
      <WatchHistoryContent />
    </ProtectedRoute>
  );
}

function WatchHistoryContent() {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<WatchHistoryFilter>('all');
  const [sortBy, setSortBy] = useState<WatchHistorySortBy>('recentlyWatched');
  const [showClearModal, setShowClearModal] = useState(false);

  // Set up auth tokens
  useEffect(() => {
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      apiClient.setAccessToken(tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      apiClient.setRefreshToken(tokens.refreshToken);
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const [historyResponse, statsResponse] = await Promise.all([
        apiClient.getWatchHistory({ page, filter, sortBy, limit: 20 }),
        apiClient.getWatchStats(),
      ]);
      setHistory(historyResponse.data);
      setMeta(historyResponse.meta);
      setStats(statsResponse);
    } catch (error) {
      console.error('Failed to fetch watch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, sortBy]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRemove = useCallback(async (videoId: string) => {
    try {
      await apiClient.removeFromWatchHistory(videoId);
      setHistory(prev => prev.filter(h => h.videoId !== videoId));
      setMeta(prev => ({ ...prev, total: prev.total - 1 }));
      // Refresh stats
      const newStats = await apiClient.getWatchStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to remove from history:', error);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      await apiClient.clearWatchHistory();
      setHistory([]);
      setMeta({ total: 0, page: 1, limit: 20, totalPages: 0 });
      setStats({
        totalWatchTimeSeconds: 0,
        totalWatchTimeMinutes: 0,
        totalWatchTimeHours: 0,
        videosWatched: 0,
        videosCompleted: 0,
      });
      setShowClearModal(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatWatchTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const filterLabels: Record<WatchHistoryFilter, string> = {
    all: 'All',
    completed: 'Completed',
    incomplete: 'In Progress',
  };

  const sortLabels: Record<WatchHistorySortBy, string> = {
    recentlyWatched: 'Recently Watched',
    oldest: 'Oldest First',
    mostViewed: 'Most Viewed',
    longestDuration: 'Longest Duration',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Watch History</h1>
              <p className="text-gray-600 mt-1">
                {stats?.videosWatched || 0} videos watched
              </p>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => setShowClearModal(true)}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear All History
              </button>
            )}
          </div>

          {/* Stats Cards */}
          {stats && stats.videosWatched > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-primary-600">
                  {stats.videosWatched}
                </div>
                <div className="text-sm text-gray-600">Videos Watched</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-600">
                  {stats.videosCompleted}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {formatWatchTime(stats.totalWatchTimeSeconds)}
                </div>
                <div className="text-sm text-gray-600">Total Watch Time</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['all', 'completed', 'incomplete'] as WatchHistoryFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as WatchHistorySortBy)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {(Object.keys(sortLabels) as WatchHistorySortBy[]).map((sort) => (
              <option key={sort} value={sort}>
                {sortLabels[sort]}
              </option>
            ))}
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
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No watch history yet' : `No ${filterLabels[filter].toLowerCase()} videos`}
            </h2>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? 'Videos you watch will appear here.'
                : filter === 'completed'
                  ? 'Videos you finish watching will appear here.'
                  : 'Videos you started but haven\'t finished will appear here.'}
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
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex">
                    {/* Thumbnail */}
                    <Link href={`/videos/${item.video.id}`} className="relative w-40 h-24 flex-shrink-0">
                      <Image
                        src={item.video.thumbnailUrl}
                        alt={item.video.title}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                        {formatDuration(item.video.duration)}
                      </div>
                      {/* Progress indicator */}
                      {item.watchDuration && !item.completed && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300">
                          <div
                            className="h-full bg-primary-500"
                            style={{ width: `${Math.min(100, (item.watchDuration / item.video.duration) * 100)}%` }}
                          />
                        </div>
                      )}
                      {item.completed && (
                        <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Watched
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 p-4">
                      <Link href={`/videos/${item.video.id}`}>
                        <h3 className="font-semibold text-gray-900 hover:text-primary-600 transition-colors line-clamp-2">
                          {item.video.title}
                        </h3>
                      </Link>

                      <div className="flex items-center mt-1 text-sm text-gray-600">
                        {item.video.band && (
                          <>
                            <Link href={`/bands/${item.video.band.slug}`} className="hover:text-primary-600">
                              {item.video.band.name}
                            </Link>
                            <span className="mx-2">•</span>
                          </>
                        )}
                        <span>{item.video.viewCount.toLocaleString()} views</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                        <span>
                          Watched {formatDistanceToNow(new Date(item.watchedAt), { addSuffix: true })}
                        </span>
                        {item.watchDuration && (
                          <span>
                            {formatWatchTime(item.watchDuration)} watched
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center px-4">
                      <button
                        onClick={() => handleRemove(item.videoId)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors"
                        title="Remove from history"
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
                  onClick={() => fetchHistory(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => fetchHistory(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Clear All Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Clear Watch History?
              </h3>
              <p className="text-gray-600 mb-6">
                This will permanently delete your entire watch history. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
