import type { 
  Band, 
  Video, 
  PaginatedResponse, 
  VideoFilters, 
  BandFilters,
  ApiResponse 
} from '@/types/api';
import type { CreateBandDto, UpdateBandDto } from '@hbcu-band-hub/shared-types';
import type { LoginCredentials, LoginResponse, RefreshTokenResponse } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized?: () => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the access token for authenticated requests
   */
  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  /**
   * Set the refresh token for token refresh
   */
  setRefreshToken(token: string | null) {
    this.refreshToken = token;
  }

  /**
   * Set callback for unauthorized errors (401)
   */
  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    skipAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Add authorization header if we have an access token
    if (this.accessToken && !skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401 && !skipAuth) {
        // Try to refresh token
        if (this.refreshToken && endpoint !== '/api/auth/refresh') {
          try {
            await this.refreshAccessToken();
            // Retry the original request with new token
            return this.request<T>(endpoint, options, skipAuth);
          } catch (refreshError) {
            // Refresh failed, trigger unauthorized callback
            if (this.onUnauthorized) {
              this.onUnauthorized();
            }
            throw new Error('Session expired. Please login again.');
          }
        } else {
          // No refresh token available or refresh endpoint failed
          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
          throw new Error('Unauthorized. Please login.');
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: 'An error occurred',
        }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ============ AUTH METHODS ============

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ 
          email: credentials.email, 
          password: credentials.password 
        }),
      },
      true // Skip auth for login
    );

    // Store tokens
    this.setAccessToken(response.accessToken);
    this.setRefreshToken(response.refreshToken);

    return response;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<RefreshTokenResponse>(
      '/api/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      },
      true // Skip auth for refresh
    );

    // Update tokens
    this.setAccessToken(response.accessToken);
    this.setRefreshToken(response.refreshToken);

    return response;
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    if (!this.refreshToken) {
      return;
    }

    try {
      await this.request<{ message: string }>(
        '/api/auth/logout',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        }
      );
    } finally {
      // Clear tokens even if logout request fails
      this.setAccessToken(null);
      this.setRefreshToken(null);
    }
  }

  // Band methods
  async getBands(filters?: BandFilters): Promise<PaginatedResponse<Band>> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<PaginatedResponse<Band>>(
      `/api/bands${query ? `?${query}` : ''}`
    );
  }

  async getBand(slug: string): Promise<Band> {
    return this.request<Band>(`/api/bands/slug/${slug}`);
  }

  async createBand(data: CreateBandDto): Promise<Band> {
    return this.request<Band>(`/api/bands`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBand(id: string, data: UpdateBandDto): Promise<Band> {
    return this.request<Band>(`/api/bands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBand(id: string): Promise<void> {
    await this.request<void>(`/api/bands/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadBandLogo(id: string, file: File): Promise<ApiResponse<{ logoUrl: string }>> {
    const formData = new FormData();
    formData.append('logo', file);

    const url = `${this.baseUrl}/api/bands/${id}/logo`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: 'Failed to upload logo',
        }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Logo upload failed:', error);
      throw error;
    }
  }

  async deleteBandLogo(id: string): Promise<ApiResponse<Band>> {
    return this.request<ApiResponse<Band>>(`/api/bands/${id}/logo`, {
      method: 'DELETE',
    });
  }

  // Video methods
  async getVideos(filters?: VideoFilters): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams();
    if (filters?.bandId) params.append('bandId', filters.bandId);
    if (filters?.category) params.append('category', filters.category); // Changed from categoryId
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<PaginatedResponse<Video>>(
      `/api/videos${query ? `?${query}` : ''}`
    );
  }

  async getVideo(id: string): Promise<Video> {
    return this.request<Video>(`/api/videos/${id}`);
  }

  async searchVideos(query: string): Promise<Video[]> {
    const params = new URLSearchParams({ q: query });
    return this.request<Video[]>(`/api/videos/search?${params}`);
  }

  async getCategories(): Promise<any[]> {
    return this.request<any[]>(`/api/categories`);
  }


// Sync methods
async triggerFullSync(): Promise<any> {
  return this.request<any>(`/api/sync/trigger`, {
    method: 'POST',
  });
}

async triggerBandSync(bandId: string, syncType: 'channel' | 'playlist' | 'search' = 'channel'): Promise<any> {
  return this.request<any>(`/api/sync/band/${bandId}`, {
    method: 'POST',
    body: JSON.stringify({ syncType }),
  });
}

async getSyncStatus(): Promise<any> {
  return this.request<any>(`/api/sync/status`);
}
}

export const apiClient = new ApiClient(API_URL);