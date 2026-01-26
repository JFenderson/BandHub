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
  DashboardStats,
  RecentActivity,
  SyncStatus,
  Event,
  EventFilters,
  CreateEventDto,
  UpdateEventDto,
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  VideoTrend,
  CategoryDistribution,
  TopBand,
  TrendingVideo,
  TrendingVideoFilters,
} from '@/types/api';
import type { CreateBandDto, UpdateBandDto } from '@hbcu-band-hub/shared-types';
import type { LoginCredentials, LoginResponse, RefreshTokenResponse } from '@/types/auth';
const getApiUrl = () => {
  // Server-side (Node.js environment)
  if (typeof window === 'undefined') {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  }
  // Client-side (browser)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
};

const API_URL = getApiUrl();

console.log('🔍 API_URL being used:', API_URL);

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized?: () => void;
  private apiVersion: string = 'v1'; // Default to v1
  private onDeprecationWarning?: (warning: DeprecationWarning) => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the API version to use (e.g., 'v1', 'v2')
   * This allows testing new versions before switching the entire app
   */
  setApiVersion(version: string) {
    this.apiVersion = version;
    // Update base URL to use the new version
    this.baseUrl = this.baseUrl.replace(/\/v\d+$/, `/${version}`);
  }

  /**
   * Get the current API version being used
   */
  getApiVersion(): string {
    return this.apiVersion;
  }

  /**
   * Set callback for deprecation warnings
   */
  setOnDeprecationWarning(callback: (warning: DeprecationWarning) => void) {
    this.onDeprecationWarning = callback;
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
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

      // Check for deprecation warnings
      this.checkDeprecationHeaders(response);

      // Clone the response so we can read it twice for logging
      const responseClone = response.clone();
      const responseText = await responseClone.text();

      const jsonData = JSON.parse(responseText);


      // Handle 401 Unauthorized
      if (response.status === 401 && !skipAuth) {
        // Try to refresh token
        if (this.refreshToken && endpoint !== '/auth/refresh') {
          try {
            await this.refreshAccessToken();
            // Retry the original request with new token
            return this.request<T>(endpoint, options, skipAuth);
          } catch (refreshError) {
            // Refresh failed, trigger unauthorized callback
            if (this.onUnauthorized) {
              this.onUnauthorized();
            }
            throw new Error('Session expired.  Please login again.');
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
        const error = jsonData || { message: 'An error occurred' };
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return jsonData;
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
      '/auth/login',
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
      '/auth/refresh',
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
      await this.request<{ message: string }>('/auth/logout', {
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
    if (filters?.conference) params.append('conference', filters.conference);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<PaginatedResponse<Band>>(`/bands${query ? `?${query}` : ''}`);
  }

  async getBand(slug: string): Promise<Band> {
    return this.request<Band>(`/bands/slug/${slug}`);
  }

  async createBand(data: CreateBandDto): Promise<Band> {
    return this.request<Band>(`/bands`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBand(id: string, data: UpdateBandDto): Promise<Band> {
    return this.request<Band>(`/bands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBand(id: string): Promise<void> {
    await this.request<void>(`/bands/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadBandLogo(id: string, file: File): Promise<ApiResponse<{ logoUrl: string }>> {
    const formData = new FormData();
    formData.append('logo', file);

    const url = `${this.baseUrl}/bands/${id}/upload-logo`;
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

    const url = `${this.baseUrl}/bands/${id}/upload-banner`;
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
    return this.request<ApiResponse<Band>>(`/bands/${id}/logo`, {
      method: 'DELETE',
    });
  }

  // Video methods
  async getVideos(filters?: VideoFilters): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams();
    if (filters?.bandId) params.append('bandId', filters.bandId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.year) params.append('eventYear', filters.year.toString());
    if (filters?.conference) params.append('conference', filters.conference);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    const result = await this.request<PaginatedResponse<Video>>(
      `/videos${query ? `?${query}` : ''}`,
    );

    return result;
  }

  async getVideo(id: string): Promise<Video> {
    return this.request<Video>(`/videos/${id}`);
  }

  async searchVideos(query: string): Promise<Video[]> {
    const params = new URLSearchParams({ q: query });
    return this.request<Video[]>(`/videos/search?${params}`);
  }

  // ============ TRENDING VIDEOS METHODS ============

  /**
   * Get trending videos based on weighted algorithm with time decay
   * Score = (recentViews * 0.4) + (recency * 0.3) + (quality * 0.2) + (engagement * 0.1)
   */
  async getTrendingVideos(filters?: TrendingVideoFilters): Promise<TrendingVideo[]> {
    const params = new URLSearchParams();
    if (filters?.timeframe) params.append('timeframe', filters.timeframe);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return this.request<TrendingVideo[]>(`/videos/trending${query ? `?${query}` : ''}`);
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
    return this.request<PaginatedResponse<Creator>>(`/creators${query ? `?${query}` : ''}`);
  }

  async getCreator(id: string): Promise<Creator> {
    return this.request<Creator>(`/creators/${id}`);
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
      `/creators/${id}/videos${query ? `?${query}` : ''}`,
    );
  }

  async getFeaturedCreators(): Promise<PaginatedResponse<Creator>> {
    return this.request<PaginatedResponse<Creator>>(`/creators/featured`);
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
    }>(`/admin/videos${query ? `?${query}` : ''}`);
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
    return this.request<VideoDetail>(`/admin/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async bulkUpdateVideos(data: BulkVideoUpdateRequest): Promise<BulkVideoUpdateResponse> {
    return this.request<BulkVideoUpdateResponse>(`/admin/videos/bulk`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Sync methods
  async triggerFullSync(): Promise<any> {
    return this.request<any>(`/sync/trigger`, {
      method: 'POST',
    });
  }

  async triggerBandSync(
    bandId: string,
    syncType: 'channel' | 'playlist' | 'search' = 'channel',
  ): Promise<any> {
    return this.request<any>(`/sync/band/${bandId}`, {
      method: 'POST',
      body: JSON.stringify({ syncType }),
    });
  }

  async getSyncStatus(): Promise<any> {
    return this.request<any>(`/sync/status`);
  }

  async getSyncJobStatus(jobId: string): Promise<any> {
    return this.request<any>(`/sync/job/${jobId}`);
  }

  // Featured Bands methods
  async getFeaturedBands(): Promise<{ bands: any[] }> {
    return this.request<{ bands: any[] }>(`/bands/featured`);
  }

  async trackFeaturedClick(bandId: string, sessionId?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bands/${bandId}/track-featured-click`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async toggleBandFeatured(bandId: string): Promise<any> {
    return this.request<any>(`/bands/${bandId}/featured`, {
      method: 'PATCH',
    });
  }

  async updateFeaturedOrder(
    bands: Array<{ id: string; featuredOrder: number }>,
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bands/featured-order`, {
      method: 'PATCH',
      body: JSON.stringify({ bands }),
    });
  }

  async getFeaturedRecommendations(): Promise<{ recommendations: any[] }> {
    return this.request<{ recommendations: any[] }>(`/bands/featured-recommendations`);
  }

  async getFeaturedAnalytics(): Promise<any> {
    return this.request<any>(`/bands/featured-analytics`);
  }

  // ============ CATEGORIES METHODS ============

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>(`/categories`);
  }

  async getCategoryById(id: string): Promise<Category> {
    return this.request<Category>(`/categories/${id}`);
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    return this.request<Category>(`/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderCategories(categoryIds: string[]): Promise<Category[]> {
    return this.request<Category[]>(`/categories/reorder`, {
      method: 'POST',
      body: JSON.stringify({ categoryIds }),
    });
  }

  async mergeCategories(sourceCategoryId: string, targetCategoryId: string): Promise<{
    message: string;
    videosMoved: number;
    deletedCategory: string;
    targetCategory: string;
  }> {
    return this.request(`/categories/merge`, {
      method: 'POST',
      body: JSON.stringify({ sourceCategoryId, targetCategoryId }),
    });
  }

  // ============ EVENTS METHODS ============

  async getEvents(filters?: EventFilters): Promise<PaginatedResponse<Event>> {
    const params = new URLSearchParams();
    if (filters?.eventType) params.append('eventType', filters.eventType);
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.state) params.append('state', filters.state);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString();
    return this.request<PaginatedResponse<Event>>(`/events${query ? `?${query}` : ''}`);
  }

  async getEventById(id: string): Promise<Event> {
    return this.request<Event>(`/events/${id}`);
  }

  async getEventBySlug(slug: string): Promise<Event> {
    return this.request<Event>(`/events/slug/${slug}`);
  }

  async getEventTypes(): Promise<string[]> {
    return this.request<string[]>(`/events/types`);
  }

  async getUpcomingEvents(limit?: number): Promise<Event[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request<Event[]>(`/events/upcoming${params}`);
  }

  async getEventsByYear(year: number): Promise<Event[]> {
    return this.request<Event[]>(`/events/year/${year}`);
  }

  async createEvent(data: CreateEventDto): Promise<Event> {
    return this.request<Event>(`/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: UpdateEventDto): Promise<Event> {
    return this.request<Event>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.request<void>(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  async addVideoToEvent(eventId: string, videoId: string): Promise<void> {
    await this.request<void>(`/events/${eventId}/videos`, {
      method: 'POST',
      body: JSON.stringify({ videoId }),
    });
  }

  async removeVideoFromEvent(eventId: string, videoId: string): Promise<void> {
    await this.request<void>(`/events/${eventId}/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  async getEventVideos(eventId: string): Promise<Video[]> {
    return this.request<Video[]>(`/events/${eventId}/videos`);
  }

  async addBandToEvent(eventId: string, bandId: string, role?: string): Promise<void> {
    await this.request<void>(`/events/${eventId}/bands`, {
      method: 'POST',
      body: JSON.stringify({ bandId, role }),
    });
  }

  async removeBandFromEvent(eventId: string, bandId: string): Promise<void> {
    await this.request<void>(`/events/${eventId}/bands/${bandId}`, {
      method: 'DELETE',
    });
  }

  async getEventBands(eventId: string): Promise<Band[]> {
    return this.request<Band[]>(`/events/${eventId}/bands`);
  }

  // ============ SYNC METHODS ============

  async getSyncJobs(filters?: {
    status?: string;
    jobType?: string;
    bandId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: any[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.jobType) params.append('jobType', filters.jobType);
    if (filters?.bandId) params.append('bandId', filters.bandId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString();
    return this.request(`/admin/sync-jobs${query ? `?${query}` : ''}`);
  }

  async getSyncJobById(id: string): Promise<any> {
    return this.request(`/admin/sync-jobs/${id}`);
  }

  async retrySyncJob(id: string): Promise<void> {
    await this.request(`/admin/sync-jobs/${id}/retry`, {
      method: 'POST',
    });
  }

  async triggerManualSync(options?: {
    bandId?: string;
    jobType?: string;
    maxVideos?: number;
  }): Promise<any> {
    return this.request(`/admin/sync-jobs/trigger`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async getQueueStatus(): Promise<any[]> {
    return this.request(`/admin/queue/status`);
  }

  async pauseQueue(): Promise<void> {
    await this.request(`/admin/queue/pause`, {
      method: 'POST',
    });
  }

  async resumeQueue(): Promise<void> {
    await this.request(`/admin/queue/resume`, {
      method: 'POST',
    });
  }

  async clearFailedJobs(): Promise<void> {
    await this.request(`/admin/queue/clear-failed`, {
      method: 'POST',
    });
  }

  async getSyncErrors(): Promise<any> {
    return this.request(`/admin/sync/errors`);
  }

  // Admin Dashboard methods
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/admin/dashboard/stats');
  }

  async getRecentActivity(): Promise<RecentActivity> {
    return this.request<RecentActivity>('/admin/dashboard/recent-activity');
  }

  async getSyncStatusDashboard(): Promise<SyncStatus> {
    return this.request<SyncStatus>('/admin/dashboard/sync-status');
  }

  async getVideoTrends(): Promise<VideoTrend[]> {
    return this.request<VideoTrend[]>('/admin/dashboard/video-trends');
  }

  async getCategoryDistribution(): Promise<CategoryDistribution[]> {
    return this.request<CategoryDistribution[]>('/admin/dashboard/category-distribution');
  }

  async getTopBands(): Promise<TopBand[]> {
    return this.request<TopBand[]>('/admin/dashboard/top-bands');
  }

  /**
   * Check response headers for API version deprecation warnings
   */
  private checkDeprecationHeaders(response: Response) {
    const deprecationHeader = response.headers.get('Deprecation');
    const sunsetHeader = response.headers.get('Sunset');
    const warningHeader = response.headers.get('X-API-Deprecation-Warning');
    const replacementVersion = response.headers.get('X-API-Replacement-Version');

    if (deprecationHeader || sunsetHeader) {
      const warning: DeprecationWarning = {
        currentVersion: this.apiVersion,
        message: warningHeader || 'This API version is deprecated',
        sunsetDate: sunsetHeader ? new Date(sunsetHeader) : undefined,
        replacementVersion: replacementVersion || undefined,
      };

      // Log warning to console
      console.warn(
        `⚠️ API Deprecation Warning: ${warning.message}`,
        warning.sunsetDate ? `Sunset date: ${warning.sunsetDate.toLocaleDateString()}` : '',
        warning.replacementVersion ? `Please upgrade to ${warning.replacementVersion}` : ''
      );

      // Call callback if provided
      if (this.onDeprecationWarning) {
        this.onDeprecationWarning(warning);
      }
    }
  }
}

/**
 * Deprecation warning information
 */
export interface DeprecationWarning {
  currentVersion: string;
  message: string;
  sunsetDate?: Date;
  replacementVersion?: string;
}

export const apiClient = new ApiClient(API_URL);
