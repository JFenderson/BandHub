'use client';

import { useState, useEffect } from 'react';
import { Plus, Filter, SortAsc } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { usePlaylists } from '@/hooks/usePlaylists';
import { CreatePlaylistModal } from '@/components/playlists/CreatePlaylistModal';
import { EditPlaylistModal } from '@/components/playlists/EditPlaylistModal';
import { PlaylistsGrid } from '@/components/playlists/PlaylistsGrid';
import type { Playlist } from '@/lib/api/playlists';

type FilterType = 'all' | 'public' | 'private';
type SortType = 'name' | 'createdAt' | 'updatedAt';

export default function PlaylistsPage() {
  const { playlists, isLoading, fetchPlaylists, totalPages, currentPage } = usePlaylists(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('updatedAt');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params: any = { page, limit: 12, sortBy };
    
    if (filter === 'public') {
      params.isPublic = true;
    } else if (filter === 'private') {
      params.isPublic = false;
    }

    fetchPlaylists(params);
  }, [filter, sortBy, page, fetchPlaylists]);

  const filteredPlaylists = playlists;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              My Playlists
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage your video playlists
            </p>
          </div>

          {/* Controls */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Create Button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Playlist
            </button>

            {/* Filters and Sort */}
            <div className="flex items-center gap-3">
              {/* Filter */}
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterType)}
                  className="pl-9 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="Filter playlists"
                >
                  <option value="all">All Playlists</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Sort */}
              <div className="relative">
                <SortAsc className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="pl-9 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="Sort playlists"
                >
                  <option value="name">Name</option>
                  <option value="createdAt">Date Created</option>
                  <option value="updatedAt">Date Updated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Playlists Grid */}
          <PlaylistsGrid
            playlists={filteredPlaylists}
            loading={isLoading}
            onEdit={setEditingPlaylist}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="flex items-center gap-2" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return (
                      <span key={pageNum} className="px-2 text-gray-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Modals */}
        <CreatePlaylistModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchPlaylists({ page, limit: 12, sortBy });
          }}
        />

        {editingPlaylist && (
          <EditPlaylistModal
            isOpen={true}
            playlist={editingPlaylist}
            onClose={() => setEditingPlaylist(null)}
            onSuccess={() => {
              fetchPlaylists({ page, limit: 12, sortBy });
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
