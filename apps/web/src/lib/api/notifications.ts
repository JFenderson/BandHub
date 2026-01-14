const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export type NotificationType = 'NEW_VIDEO' | 'UPCOMING_EVENT' | 'WEEKLY_DIGEST';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  emailNewVideo: boolean;
  emailUpcoming: boolean;
  emailWeeklyDigest: boolean;
  inAppNotifications: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface NotificationStats {
  total: number;
  unread: number;
}

class NotificationsApiClient {
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

  async getNotifications(params?: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'unread' | 'read';
    type?: NotificationType;
  }): Promise<PaginatedResponse<Notification>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.type) searchParams.set('type', params.type);

    const query = searchParams.toString();
    return this.request(`/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request('/notifications/unread-count');
  }

  async getStats(): Promise<NotificationStats> {
    return this.request('/notifications/stats');
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllAsRead(): Promise<{ count: number }> {
    return this.request('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async deleteNotification(notificationId: string): Promise<{ message: string }> {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async getPreferences(): Promise<NotificationPreferences> {
    return this.request('/notifications/preferences');
  }

  async updatePreferences(preferences: Partial<Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>>): Promise<NotificationPreferences> {
    return this.request('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }
}

export const notificationsApiClient = new NotificationsApiClient(API_URL);
