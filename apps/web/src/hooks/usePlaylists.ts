'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPlaylistsApiClient, type Playlist, type CreatePlaylistDto, type UpdatePlaylistDto, type GetPlaylistsParams } from '@/lib/api/playlists';
import { useUser } from '@/contexts/UserContext';
import { getAuthTokens } from '@/lib/utils/cookies';

/**
 * Custom hook for managing playlists
 */
export function usePlaylists(autoFetch = true) {
  const { user } = useUser();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const apiClient = useMemo(
    () => getPlaylistsApiClient(() => getAuthTokens().accessToken),
    []
  );

  /**
   * Fetch user's playlists
   */
  const fetchPlaylists = useCallback(async (params?: GetPlaylistsParams) => {
    if (!user) {
      setPlaylists([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getUserPlaylists(params);
      setPlaylists(response.data);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch playlists');
      console.error('Error fetching playlists:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, apiClient]);

  /**
   * Create a new playlist
   */
  const createPlaylist = useCallback(async (data: CreatePlaylistDto): Promise<Playlist> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      const newPlaylist = await apiClient.createPlaylist(data);
      setPlaylists(prev => [newPlaylist, ...prev]);
      return newPlaylist;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Update a playlist
   */
  const updatePlaylist = useCallback(async (id: string, data: UpdatePlaylistDto): Promise<Playlist> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      const updatedPlaylist = await apiClient.updatePlaylist(id, data);
      setPlaylists(prev => prev.map(p => p.id === id ? updatedPlaylist : p));
      return updatedPlaylist;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Delete a playlist
   */
  const deletePlaylist = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      await apiClient.deletePlaylist(id);
      setPlaylists(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Add a video to a playlist
   */
  const addVideoToPlaylist = useCallback(async (playlistId: string, videoId: string): Promise<void> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      await apiClient.addVideoToPlaylist(playlistId, videoId);
      // Optionally refetch the specific playlist to update video count
      const updated = await apiClient.getPlaylist(playlistId);
      setPlaylists(prev => prev.map(p => p.id === playlistId ? updated : p));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add video to playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Remove a video from a playlist
   */
  const removeVideoFromPlaylist = useCallback(async (playlistId: string, videoId: string): Promise<void> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      await apiClient.removeVideoFromPlaylist(playlistId, videoId);
      // Optionally refetch the specific playlist to update video count
      const updated = await apiClient.getPlaylist(playlistId);
      setPlaylists(prev => prev.map(p => p.id === playlistId ? updated : p));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove video from playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Reorder videos in a playlist
   */
  const reorderPlaylistVideos = useCallback(async (playlistId: string, videoIds: string[]): Promise<void> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      await apiClient.reorderPlaylistVideos(playlistId, videoIds);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder playlist videos';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  /**
   * Get a single playlist
   */
  const getPlaylist = useCallback(async (id: string): Promise<Playlist> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setError(null);
    try {
      return await apiClient.getPlaylist(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch playlist';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient]);

  // Auto-fetch playlists on mount if enabled
  useEffect(() => {
    if (autoFetch && user) {
      fetchPlaylists();
    }
  }, [autoFetch, user, fetchPlaylists]);

  return {
    playlists,
    isLoading,
    error,
    totalPages,
    currentPage,
    fetchPlaylists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    reorderPlaylistVideos,
    getPlaylist,
  };
}
