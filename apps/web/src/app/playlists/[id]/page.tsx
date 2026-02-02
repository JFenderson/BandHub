'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit2, Trash2, Share2, ArrowLeft } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { usePlaylists } from '@/hooks/usePlaylists';
import { EditPlaylistModal } from '@/components/playlists/EditPlaylistModal';
import { SortablePlaylistVideo } from '@/components/playlists/SortablePlaylistVideo';
import type { Playlist, PlaylistVideo } from '@/lib/api/playlists';

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params?.id as string;
  
  const { getPlaylist, removeVideoFromPlaylist, reorderPlaylistVideos, deletePlaylist } = usePlaylists(false);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadPlaylist = async () => {
    try {
      setIsLoading(true);
      const data = await getPlaylist(playlistId);
      setPlaylist(data);
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to load playlist:', error);
      setToast({ type: 'error', message: 'Failed to load playlist' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.videoId === active.id);
    const newIndex = videos.findIndex((v) => v.videoId === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newVideos = arrayMove(videos, oldIndex, newIndex);
    setVideos(newVideos);

    try {
      await reorderPlaylistVideos(
        playlistId,
        newVideos.map((v) => v.videoId)
      );
      setToast({ type: 'success', message: 'Playlist order updated' });
    } catch (error) {
      setVideos(videos);
      setToast({ type: 'error', message: 'Failed to update order' });
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      await removeVideoFromPlaylist(playlistId, videoId);
      setVideos(videos.filter((v) => v.videoId !== videoId));
      if (playlist) {
        setPlaylist({
          ...playlist,
          _count: { videos: (playlist._count?.videos || 1) - 1 },
        });
      }
      setToast({ type: 'success', message: 'Video removed from playlist' });
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to remove video' });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePlaylist(playlistId);
      setToast({ type: 'success', message: 'Playlist deleted' });
      router.push('/playlists');
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to delete playlist' });
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/playlists/${playlistId}`;
    navigator.clipboard.writeText(url);
    setToast({ type: 'success', message: 'Link copied to clipboard' });
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading playlist...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!playlist) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Playlist Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The playlist you're looking for doesn't exist.
            </p>
            <button
              onClick={() => router.push('/playlists')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Back to Playlists
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <button
            onClick={() => router.push('/playlists')}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Playlists
          </button>

          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {playlist.name}
                </h1>
                {playlist.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {playlist.description}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  {playlist._count?.videos || 0} videos · {playlist.isPublic ? 'Public' : 'Private'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Edit playlist"
                  title="Edit playlist"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Share playlist"
                  title="Share playlist"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  aria-label="Delete playlist"
                  title="Delete playlist"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Videos */}
          {videos.length === 0 ? (
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
                No videos yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Start adding videos to this playlist
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Videos ({videos.length})
              </h2>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={videos.map((v) => v.videoId)}
                  strategy={verticalListSortingStrategy}
                >
                  {videos.map((playlistVideo) => (
                    <SortablePlaylistVideo
                      key={playlistVideo.videoId}
                      playlistVideo={playlistVideo}
                      onRemove={handleRemoveVideo}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50">
            <div
              className={`px-4 py-3 rounded-lg shadow-lg ${
                toast.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
            <div
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Delete Playlist
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{playlist.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && (
          <EditPlaylistModal
            isOpen={isEditModalOpen}
            playlist={playlist}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={loadPlaylist}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
