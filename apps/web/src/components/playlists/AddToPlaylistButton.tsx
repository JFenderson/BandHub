'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useUser } from '@/contexts/UserContext';

interface AddToPlaylistButtonProps {
  videoId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function AddToPlaylistButton({
  videoId,
  size = 'md',
  showLabel = false,
  className = '',
}: AddToPlaylistButtonProps) {
  const { isAuthenticated } = useUser();
  const { playlists, addVideoToPlaylist, isLoading: playlistsLoading, fetchPlaylists } = usePlaylists(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addedPlaylists, setAddedPlaylists] = useState<Set<string>>(new Set());
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setToast({ type: 'error', message: 'Please log in to add to playlist' });
      return;
    }

    // Fetch playlists when opening dropdown
    if (!isOpen && playlists.length === 0) {
      fetchPlaylists();
    }

    setIsOpen(!isOpen);
  };

  const handleAddToPlaylist = async (playlistId: string, playlistName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (addedPlaylists.has(playlistId)) {
      return;
    }

    setLoadingPlaylistId(playlistId);
    try {
      await addVideoToPlaylist(playlistId, videoId);
      setAddedPlaylists(prev => new Set(prev).add(playlistId));
      setToast({ type: 'success', message: `Added to ${playlistName}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add to playlist';
      setToast({ type: 'error', message });
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleButtonClick}
        className={`
          ${buttonSizeClasses[size]}
          rounded-full transition-all duration-200
          text-gray-400 hover:text-primary-500
          hover:bg-gray-100 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          ${className}
        `}
        aria-label="Add to playlist"
        title="Add to playlist"
      >
        <Plus className={sizeClasses[size]} />
        {showLabel && <span className="ml-1 text-sm">Add to Playlist</span>}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            <div className="px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 mb-2">
              Add to Playlist
            </div>

            {playlistsLoading ? (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                Loading playlists...
              </div>
            ) : playlists.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                No playlists yet. Create one first!
              </div>
            ) : (
              <ul className="space-y-1">
                {playlists.map((playlist) => {
                  const isAdded = addedPlaylists.has(playlist.id);
                  const isLoading = loadingPlaylistId === playlist.id;

                  return (
                    <li key={playlist.id}>
                      <button
                        onClick={(e) => handleAddToPlaylist(playlist.id, playlist.name, e)}
                        disabled={isAdded || isLoading}
                        className={`
                          w-full px-3 py-2 text-left text-sm rounded-md transition-colors
                          flex items-center justify-between gap-2
                          ${isAdded
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-default'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }
                          ${isLoading ? 'opacity-50 cursor-wait' : ''}
                        `}
                      >
                        <span className="flex-1 truncate">{playlist.name}</span>
                        {isAdded && <Check className="w-4 h-4 flex-shrink-0" />}
                        {isLoading && (
                          <svg
                            className="animate-spin h-4 w-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`
            fixed bottom-4 right-4 z-50
            px-4 py-3 rounded-lg shadow-lg text-sm font-medium
            ${toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
            }
            animate-fade-in
          `}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
