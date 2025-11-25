'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { favoritesApiClient, type FavoriteVideo, type PaginatedResponse } from '@/lib/api/favorites';
import { FavoriteButton } from '@/components/videos/FavoriteButton';
import { getAuthTokens } from '@/lib/utils/cookies';

export default function FavoritesPage() {
  return (
    <ProtectedRoute>
      <FavoritesContent />
    </ProtectedRoute>
  );
}

function FavoritesContent() {
  const [favorites, setFavorites] = useState<FavoriteVideo[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recentlyAdded' | 'oldest' | 'mostViewed'>('recentlyAdded');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  // Set up token provider
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  const fetchFavorites = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await favoritesApiClient.getFavoriteVideos({ page, sortBy });
      setFavorites(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemoveFavorite = useCallback(async (videoId: string) => {
    try {
      await favoritesApiClient.removeFavoriteVideo(videoId);
      setFavorites(prev => prev.filter(f => f.videoId !== videoId));
      setMeta(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }, []);

  const handleSaveNotes = useCallback(async (videoId: string) => {
    try {
      await favoritesApiClient.updateFavoriteVideo(videoId, notesValue);
      setFavorites(prev => 
        prev.map(f => f.videoId === videoId ? { ...f, notes: notesValue } : f)
      );
      setEditingNotes(null);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }, [notesValue]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Favorite Videos</h1>
            <p className="text-gray-600 mt-1">{meta.total} videos saved</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="recentlyAdded">Recently Added</option>
              <option value="oldest">Oldest First</option>
              <option value="mostViewed">Most Viewed</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No favorites yet</h2>
            <p className="text-gray-600 mb-6">Start exploring videos and save your favorites!</p>
            <Link
              href="/videos"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Browse Videos
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favorites.map((favorite) => (
                <div key={favorite.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <Link href={`/videos/${favorite.video.id}`}>
                    <div className="relative aspect-video bg-gray-900">
                      <Image
                        src={favorite.video.thumbnailUrl}
                        alt={favorite.video.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(favorite.video.duration)}
                      </div>
                    </div>
                  </Link>
                  
                  <div className="p-4">
                    <Link href={`/videos/${favorite.video.id}`}>
                      <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary-600 transition-colors">
                        {favorite.video.title}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center mt-2 text-sm text-gray-600">
                      <Link href={`/bands/${favorite.video.band.slug}`} className="hover:text-primary-600">
                        {favorite.video.band.name}
                      </Link>
                      <span className="mx-2">•</span>
                      <span>{favorite.video.viewCount.toLocaleString()} views</span>
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-1">
                      Added {formatDistanceToNow(new Date(favorite.createdAt), { addSuffix: true })}
                    </div>

                    {/* Notes Section */}
                    {editingNotes === favorite.videoId ? (
                      <div className="mt-3">
                        <textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          rows={2}
                          placeholder="Add notes..."
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveNotes(favorite.videoId)}
                            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : favorite.notes ? (
                      <div 
                        className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setEditingNotes(favorite.videoId);
                          setNotesValue(favorite.notes || '');
                        }}
                      >
                        {favorite.notes}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingNotes(favorite.videoId);
                          setNotesValue('');
                        }}
                        className="mt-3 text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Add notes
                      </button>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <FavoriteButton
                        videoId={favorite.videoId}
                        initialFavorited={true}
                        size="sm"
                        onToggle={(favorited) => {
                          if (!favorited) {
                            handleRemoveFavorite(favorite.videoId);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleRemoveFavorite(favorite.videoId)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        Remove
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
                  onClick={() => fetchFavorites(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => fetchFavorites(meta.page + 1)}
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
