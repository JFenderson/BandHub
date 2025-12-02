import type {
  Band,
  Video,
  Creator,
  PaginatedResponse,
  VideoFilters,
  BandFilters,
  CreatorFilters,
  ApiResponse,
  AdminVideoFilters,
  VideoDetail,
  BulkVideoUpdateRequest,
  BulkVideoUpdateResponse,
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
    skipAuth: boolean = false,
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
   * Note: rememberMe is handled by cookie maxAge in setAuthTokens
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          // rememberMe is not sent to backend, it's handled client-side via cookie duration
        }),
      },
      true, // Skip auth for login
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
      true, // Skip auth for refresh
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
      await this.request<{ message: string }>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
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
    return this.request<PaginatedResponse<Band>>(`/api/bands${query ? `?${query}` : ''}`);
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

    const url = `${this.baseUrl}/api/bands/${id}/upload-logo`;
    const headers: HeadersInit = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
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

  async uploadBandBanner(id: string, file: File): Promise<ApiResponse<{ bannerUrl: string }>> {
    const formData = new FormData();
    formData.append('banner', file);

    const url = `${this.baseUrl}/api/bands/${id}/upload-banner`;
    const headers: HeadersInit = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: 'Failed to upload banner',
        }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Banner upload failed:', error);
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
    return this.request<PaginatedResponse<Video>>(`/api/videos${query ? `?${query}` : ''}`);
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

  // Creator methods
  async getCreators(filters?: CreatorFilters): Promise<PaginatedResponse<Creator>> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isFeatured !== undefined) params.append('isFeatured', String(filters.isFeatured));
    if (filters?.isVerified !== undefined) params.append('isVerified', String(filters.isVerified));
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<PaginatedResponse<Creator>>(`/api/creators${query ? `?${query}` : ''}`);
  }

  async getCreator(id: string): Promise<Creator> {
    return this.request<Creator>(`/api/creators/${id}`);
  }

  async getCreatorVideos(id: string, filters?: VideoFilters): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<PaginatedResponse<Video>>(
      `/api/creators/${id}/videos${query ? `?${query}` : ''}`,
    );
  }

  async getFeaturedCreators(): Promise<PaginatedResponse<Creator>> {
    return this.request<PaginatedResponse<Creator>>(`/api/creators/featured`);
  }

  // Admin video moderation methods
  async getAdminVideos(filters?: AdminVideoFilters): Promise<{
    data: VideoDetail[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.bandId) params.append('bandId', filters.bandId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.opponentBandId) params.append('opponentBandId', filters.opponentBandId);
    if (filters?.eventYear) params.append('eventYear', filters.eventYear.toString());
    if (filters?.eventName) params.append('eventName', filters.eventName);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.hiddenStatus) params.append('hiddenStatus', filters.hiddenStatus);
    if (filters?.categorizationStatus)
      params.append('categorizationStatus', filters.categorizationStatus);
    if (filters?.tags) params.append('tags', filters.tags);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<{
      data: VideoDetail[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/admin/videos${query ? `?${query}` : ''}`);
  }

  async updateAdminVideo(
    videoId: string,
    updateData: {
      categoryId?: string;
      opponentBandId?: string;
      eventName?: string;
      eventYear?: number;
      tags?: string[];
      qualityScore?: number;
      isHidden?: boolean;
      hideReason?: string;
    },
  ): Promise<VideoDetail> {
    return this.request<VideoDetail>(`/api/admin/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async bulkUpdateVideos(data: BulkVideoUpdateRequest): Promise<BulkVideoUpdateResponse> {
    return this.request<BulkVideoUpdateResponse>(`/api/admin/videos/bulk`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Sync methods
  async triggerFullSync(): Promise<any> {
    return this.request<any>(`/api/sync/trigger`, {
      method: 'POST',
    });
  }

  async triggerBandSync(
    bandId: string,
    syncType: 'channel' | 'playlist' | 'search' = 'channel',
  ): Promise<any> {
    return this.request<any>(`/api/sync/band/${bandId}`, {
      method: 'POST',
      body: JSON.stringify({ syncType }),
    });
  }

  async getSyncStatus(): Promise<any> {
    return this.request<any>(`/api/sync/status`);
  }

  async getSyncJobStatus(jobId: string): Promise<any> {
    return this.request<any>(`/api/sync/job/${jobId}`);
  }

  // Featured Bands methods
  async getFeaturedBands(): Promise<{ bands: any[] }> {
    return this.request<{ bands: any[] }>(`/api/bands/featured`);
  }

  async trackFeaturedClick(bandId: string, sessionId?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/bands/${bandId}/track-featured-click`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async toggleBandFeatured(bandId: string): Promise<any> {
    return this.request<any>(`/api/bands/${bandId}/featured`, {
      method: 'PATCH',
    });
  }

  async updateFeaturedOrder(
    bands: Array<{ id: string; featuredOrder: number }>,
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/bands/featured-order`, {
      method: 'PATCH',
      body: JSON.stringify({ bands }),
    });
  }

  async getFeaturedRecommendations(): Promise<{ recommendations: any[] }> {
    return this.request<{ recommendations: any[] }>(`/api/bands/featured-recommendations`);
  }

  async getFeaturedAnalytics(): Promise<any> {
    return this.request<any>(`/api/bands/featured-analytics`);
  }

  async getCategories(): Promise<VideoCategory[]> {
    return this.request<VideoCategory[]>(`/api/categories`);
  }
}

export const apiClient = new ApiClient(API_URL);
