import type {
  UserLoginCredentials,
  UserLoginResponse,
  UserRegistrationData,
  UserProfile,
  UserSession,
  UpdateUserProfile,
} from '@/types/user';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class UserApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private sessionToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
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

    if (this.accessToken && !skipAuth) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.sessionToken && !skipAuth) {
      (headers as Record<string, string>)['x-session-token'] = this.sessionToken;
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

  /**
   * Register a new user
   */
  async register(data: UserRegistrationData): Promise<{ message: string; user: { id: string; email: string; name: string } }> {
    return this.request(
      '/users/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      true
    );
  }

  /**
   * Login user
   */
  async login(credentials: UserLoginCredentials): Promise<UserLoginResponse> {
    const response = await this.request<UserLoginResponse>(
      '/users/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      true
    );

    this.setAccessToken(response.accessToken);
    this.setSessionToken(response.sessionToken);

    return response;
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>(
        '/users/logout',
        {
          method: 'POST',
        }
      );
    } finally {
      this.setAccessToken(null);
      this.setSessionToken(null);
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    try {
      await this.request<{ message: string }>(
        '/users/logout-all',
        {
          method: 'POST',
        }
      );
    } finally {
      this.setAccessToken(null);
      this.setSessionToken(null);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    return this.request('/users/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateUserProfile): Promise<UserProfile> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(): Promise<{ message: string }> {
    const response = await this.request<{ message: string }>('/users/me', {
      method: 'DELETE',
    });
    this.setAccessToken(null);
    this.setSessionToken(null);
    return response;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request(
      '/users/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      true
    );
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.request(
      '/users/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      },
      true
    );
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.request(
      '/users/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      },
      true
    );
  }

  /**
   * Resend verification email
   */
  async resendVerification(): Promise<{ message: string }> {
    return this.request('/users/resend-verification', {
      method: 'POST',
    });
  }

  /**
   * Get all user sessions
   */
  async getSessions(): Promise<UserSession[]> {
    return this.request('/users/sessions');
  }

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return this.request(`/users/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }
}

export const userApiClient = new UserApiClient(API_URL);
