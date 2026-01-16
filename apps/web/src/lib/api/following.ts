const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface FollowUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

export interface PaginatedFollowResponse {
  data: FollowUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface FollowStatus {
  isFollowing: boolean;
}

class FollowingApiClient {
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

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ============ FOLLOW METHODS ============

  async followUser(userId: string): Promise<{ message: string }> {
    return this.request(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  async unfollowUser(userId: string): Promise<void> {
    return this.request(`/users/${userId}/follow`, {
      method: 'DELETE',
    });
  }

  async isFollowing(userId: string): Promise<FollowStatus> {
    return this.request(`/users/${userId}/follow-status`);
  }

  async getFollowers(userId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedFollowResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request(`/users/${userId}/followers${query ? `?${query}` : ''}`);
  }

  async getFollowing(userId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedFollowResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request(`/users/${userId}/following${query ? `?${query}` : ''}`);
  }

  async getFollowCounts(userId: string): Promise<FollowCounts> {
    return this.request(`/users/${userId}/follow-counts`);
  }
}

export const followingApiClient = new FollowingApiClient(API_URL);
