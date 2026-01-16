/**
 * Playlists API Client
 * Handles all playlist-related API calls
 */

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    videos: number;
  };
  videos?: PlaylistVideo[];
}

export interface PlaylistVideo {
  id: string;
  videoId: string;
  playlistId: string;
  position: number;
  addedAt: string;
  video?: {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number;
    publishedAt: string;
  };
}

export interface CreatePlaylistDto {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdatePlaylistDto {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

export interface GetPlaylistsParams {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPlaylists {
  data: Playlist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Playlists API Client
 * Requires authentication token
 */
export class PlaylistsApiClient {
  private baseUrl: string;
  private tokenProvider: () => string | null;

  constructor(baseUrl: string, tokenProvider: () => string | null) {
    this.baseUrl = baseUrl;
    this.tokenProvider = tokenProvider;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = this.tokenProvider();
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(data: CreatePlaylistDto): Promise<Playlist> {
    return this.request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get current user's playlists
   */
  async getUserPlaylists(params?: GetPlaylistsParams): Promise<PaginatedPlaylists> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const query = queryParams.toString();
    return this.request<PaginatedPlaylists>(`/playlists/me${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single playlist by ID
   */
  async getPlaylist(id: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`);
  }

  /**
   * Update a playlist
   */
  async updatePlaylist(id: string, data: UpdatePlaylistDto): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/playlists/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Add a video to a playlist
   */
  async addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number
  ): Promise<PlaylistVideo> {
    return this.request<PlaylistVideo>(`/playlists/${playlistId}/videos/${videoId}`, {
      method: 'POST',
      body: JSON.stringify({ position }),
    });
  }

  /**
   * Remove a video from a playlist
   */
  async removeVideoFromPlaylist(
    playlistId: string,
    videoId: string
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/playlists/${playlistId}/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Reorder videos in a playlist
   */
  async reorderPlaylistVideos(
    playlistId: string,
    videoIds: string[]
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/playlists/${playlistId}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ videoIds }),
    });
  }

  /**
   * Discover public playlists
   */
  async discoverPlaylists(params?: GetPlaylistsParams): Promise<PaginatedPlaylists> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const query = queryParams.toString();
    return this.request<PaginatedPlaylists>(`/playlists/discover${query ? `?${query}` : ''}`);
  }
}

// Export singleton instance with token provider
let playlistsApiClientInstance: PlaylistsApiClient | null = null;

export function getPlaylistsApiClient(tokenProvider: () => string | null): PlaylistsApiClient {
  if (!playlistsApiClientInstance) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    playlistsApiClientInstance = new PlaylistsApiClient(apiUrl, tokenProvider);
  }
  return playlistsApiClientInstance;
}
