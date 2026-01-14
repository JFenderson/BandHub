const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface FavoriteVideo {
  id: string;
  videoId: string;
  notes?: string;
  createdAt: string;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number;
    viewCount: number;
    publishedAt: string;
    band: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string;
    };
    category?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface FavoriteBand {
  id: string;
  bandId: string;
  notificationsEnabled: boolean;
  createdAt: string;
  band: {
    id: string;
    name: string;
    slug: string;
    schoolName: string;
    logoUrl?: string;
    state: string;
    _count: {
      videos: number;
    };
    latestVideo?: {
      id: string;
      title: string;
      thumbnailUrl: string;
      publishedAt: string;
    };
  };
}

export interface WatchLaterItem {
  id: string;
  videoId: string;
  watched: boolean;
  watchedAt?: string;
  createdAt: string;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number;
    viewCount: number;
    publishedAt: string;
    band: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string;
    };
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface WatchLaterResponse extends PaginatedResponse<WatchLaterItem> {
  stats: {
    total: number;
    watched: number;
    unwatched: number;
  };
}

export interface VideoStatus {
  isFavorited: boolean;
  isInWatchLater: boolean;
}

export interface BandStatus {
  isFollowed: boolean;
  followerCount: number;
}

class FavoritesApiClient {
  private baseUrl: string;
  private getTokens: () => { accessToken: string | null; sessionToken: string | null };

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.getTokens = () => ({ accessToken: null, sessionToken: null });
  }

  setTokenProvider(provider: () => { accessToken: string | null; sessionToken: string | null }) {
    this.getTokens = provider;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const { accessToken, sessionToken } = this.getTokens();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    if (sessionToken) {
      (headers as Record<string, string>)['x-session-token'] = sessionToken;
    }
    
    const config: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'An error occurred',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============ FAVORITE VIDEOS ============

  async addFavoriteVideo(videoId: string, notes?: string): Promise<FavoriteVideo> {
    return this.request(`/favorites/videos/${videoId}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async removeFavoriteVideo(videoId: string): Promise<{ message: string }> {
    return this.request(`/favorites/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  async updateFavoriteVideo(videoId: string, notes: string): Promise<FavoriteVideo> {
    return this.request(`/favorites/videos/${videoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  }

  async getFavoriteVideos(params?: {
    page?: number;
    limit?: number;
    bandId?: string;
    categoryId?: string;
    sortBy?: 'recentlyAdded' | 'oldest' | 'mostViewed';
  }): Promise<PaginatedResponse<FavoriteVideo>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.bandId) searchParams.set('bandId', params.bandId);
    if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);

    const query = searchParams.toString();
    return this.request(`/favorites/videos${query ? `?${query}` : ''}`);
  }

  async isVideoFavorited(videoId: string): Promise<{ isFavorited: boolean }> {
    return this.request(`/favorites/videos/${videoId}/status`);
  }

  // ============ FAVORITE BANDS ============

  async followBand(bandId: string): Promise<FavoriteBand> {
    return this.request(`/favorites/bands/${bandId}`, {
      method: 'POST',
    });
  }

  async unfollowBand(bandId: string): Promise<{ message: string }> {
    return this.request(`/favorites/bands/${bandId}`, {
      method: 'DELETE',
    });
  }

  async updateBandNotifications(bandId: string, notificationsEnabled: boolean): Promise<FavoriteBand> {
    return this.request(`/favorites/bands/${bandId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notificationsEnabled }),
    });
  }

  async getFollowedBands(params?: {
    page?: number;
    limit?: number;
    sortBy?: 'recentlyFollowed' | 'name' | 'videoCount';
    search?: string;
  }): Promise<PaginatedResponse<FavoriteBand>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    return this.request(`/favorites/bands${query ? `?${query}` : ''}`);
  }

  async getBandStatus(bandId: string): Promise<BandStatus> {
    return this.request(`/favorites/bands/${bandId}/status`);
  }

  // ============ WATCH LATER ============

  async addToWatchLater(videoId: string): Promise<WatchLaterItem> {
    return this.request(`/favorites/watch-later/${videoId}`, {
      method: 'POST',
    });
  }

  async removeFromWatchLater(videoId: string): Promise<{ message: string }> {
    return this.request(`/favorites/watch-later/${videoId}`, {
      method: 'DELETE',
    });
  }

  async markAsWatched(videoId: string, watched: boolean): Promise<WatchLaterItem> {
    return this.request(`/favorites/watch-later/${videoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ watched }),
    });
  }

  async getWatchLaterList(params?: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'unwatched' | 'watched';
    sortBy?: 'recentlyAdded' | 'oldest';
  }): Promise<WatchLaterResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);

    const query = searchParams.toString();
    return this.request(`/favorites/watch-later${query ? `?${query}` : ''}`);
  }

  async isInWatchLater(videoId: string): Promise<{ isInWatchLater: boolean }> {
    return this.request(`/favorites/watch-later/${videoId}/status`);
  }

  // ============ COMBINED STATUS ============

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    return this.request(`/favorites/status/${videoId}`);
  }
}

export const favoritesApiClient = new FavoritesApiClient(API_URL);
