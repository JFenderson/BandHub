'use client';

import { PlaylistCard } from './PlaylistCard';
import type { Playlist } from '@/lib/api/playlists';

interface PlaylistsGridProps {
  playlists: Playlist[];
  loading?: boolean;
  onEdit?: (playlist: Playlist) => void;
  onDelete?: (playlistId: string) => void;
}

export function PlaylistsGrid({ playlists, loading = false, onEdit }: PlaylistsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
          >
            {/* Skeleton Header */}
            <div className="h-32 bg-gray-300 dark:bg-gray-700" />
            
            {/* Skeleton Content */}
            <div className="p-4">
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-20" />
                <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No playlists yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Create your first playlist to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
