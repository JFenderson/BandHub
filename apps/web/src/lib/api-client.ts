import type { 
  Band, 
  Video, 
  PaginatedResponse, 
  VideoFilters, 
  BandFilters,
  ApiResponse 
} from '@/types/api';
import type { CreateBandDto, UpdateBandDto } from '@hbcu-band-hub/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    };

    try {
      const response = await fetch(url, config);

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