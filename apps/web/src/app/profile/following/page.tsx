'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { favoritesApiClient, type FavoriteBand, type PaginatedResponse } from '@/lib/api/favorites';
import { FollowButton } from '@/components/bands/FollowButton';
import { getAuthTokens } from '@/lib/utils/cookies';

export default function FollowingPage() {
  return (
    <ProtectedRoute>
      <FollowingContent />
    </ProtectedRoute>
  );
}

function FollowingContent() {
  const [following, setFollowing] = useState<FavoriteBand[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recentlyFollowed' | 'name' | 'videoCount'>('recentlyFollowed');
  const [search, setSearch] = useState('');

  // Set up token provider
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  const fetchFollowing = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await favoritesApiClient.getFollowedBands({ page, sortBy, search: search || undefined });
      setFollowing(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Failed to fetch following:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, search]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchFollowing();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchFollowing]);

  const handleUnfollow = useCallback(async (bandId: string) => {
    try {
      await favoritesApiClient.unfollowBand(bandId);
      setFollowing(prev => prev.filter(f => f.bandId !== bandId));
      setMeta(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (error) {
      console.error('Failed to unfollow band:', error);
    }
  }, []);

  const handleToggleNotifications = useCallback(async (bandId: string, enabled: boolean) => {
    try {
      await favoritesApiClient.updateBandNotifications(bandId, enabled);
      setFollowing(prev => 
        prev.map(f => f.bandId === bandId ? { ...f, notificationsEnabled: enabled } : f)
      );
    } catch (error) {
      console.error('Failed to update notifications:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Following</h1>
            <p className="text-gray-600 mt-1">{meta.total} bands followed</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search bands..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="recentlyFollowed">Recently Followed</option>
              <option value="name">Name (A-Z)</option>
              <option value="videoCount">Most Videos</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {search ? 'No bands found' : 'Not following any bands'}
            </h2>
            <p className="text-gray-600 mb-6">
              {search ? 'Try a different search term' : 'Follow bands to get notified about new videos!'}
            </p>
            <Link
              href="/bands"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Browse Bands
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {following.map((item) => (
                <div key={item.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Latest Video Thumbnail */}
                  {item.band.latestVideo ? (
                    <Link href={`/videos/${item.band.latestVideo.id}`} className="relative block h-32 bg-gray-900">
                      <Image
                        src={item.band.latestVideo.thumbnailUrl}
                        alt={item.band.latestVideo.title}
                        fill
                        className="object-cover opacity-90 hover:opacity-100 transition-opacity"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white text-sm font-medium line-clamp-1">{item.band.latestVideo.title}</p>
                        <p className="text-gray-300 text-xs">
                          {formatDistanceToNow(new Date(item.band.latestVideo.publishedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="h-32 bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No videos yet</span>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Band Info */}
                    <div className="flex items-center space-x-3">
                      {item.band.logoUrl ? (
                        <Image
                          src={item.band.logoUrl}
                          alt={item.band.name}
                          width={48}
                          height={48}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-bold text-lg">
                            {item.band.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/bands/${item.band.slug}`}>
                          <h3 className="font-semibold text-gray-900 hover:text-primary-600 transition-colors truncate">
                            {item.band.name}
                          </h3>
                        </Link>
                        <p className="text-sm text-gray-500 truncate">{item.band.schoolName}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center mt-3 text-sm text-gray-600">
                      <span>{item.band._count.videos} videos</span>
                      <span className="mx-2">•</span>
                      <span>{item.band.state}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleToggleNotifications(item.bandId, !item.notificationsEnabled)}
                        className={`flex items-center space-x-1 text-sm ${
                          item.notificationsEnabled ? 'text-primary-600' : 'text-gray-500'
                        }`}
                        title={item.notificationsEnabled ? 'Notifications on' : 'Notifications off'}
                      >
                        <svg 
                          className="w-5 h-5" 
                          fill={item.notificationsEnabled ? 'currentColor' : 'none'} 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span>{item.notificationsEnabled ? 'On' : 'Off'}</span>
                      </button>

                      <button
                        onClick={() => handleUnfollow(item.bandId)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        Unfollow
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
                  onClick={() => fetchFollowing(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => fetchFollowing(meta.page + 1)}
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
