'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { PlaylistCard } from './PlaylistCard';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { EditPlaylistModal } from './EditPlaylistModal';
import { usePlaylists } from '@/hooks/usePlaylists';
import type { Playlist } from '@/lib/api/playlists';

interface PlaylistManagerProps {
  userId?: string;
  showCreateButton?: boolean;
}

export function PlaylistManager({ userId, showCreateButton = true }: PlaylistManagerProps) {
  const { playlists, isLoading } = usePlaylists(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const handleEdit = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!playlists || playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No playlists yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create your first playlist to organize your favorite videos
        </p>
        {showCreateButton && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Playlist
          </button>
        )}

        {showCreateModal && (
          <CreatePlaylistModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      {showCreateButton && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Playlists</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Playlist
          </button>
        </div>
      )}

      {/* Playlists grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} onEdit={handleEdit} />
        ))}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePlaylistModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      )}
      {editingPlaylist && (
        <EditPlaylistModal
          playlist={editingPlaylist}
          isOpen={!!editingPlaylist}
          onClose={() => setEditingPlaylist(null)}
        />
      )}
    </div>
  );
}
