/**
 * Two-Factor Authentication API Client
 * Handles MFA/2FA setup, verification, and management
 */

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface MfaEnableResponse {
  backupCodes: string[];
}

export interface MfaStatusResponse {
  enabled: boolean;
  backupCodesRemaining?: number;
}

/**
 * Two-Factor Authentication API Client
 */
export class TwoFactorApiClient {
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
   * Generate a new 2FA secret and QR code
   */
  async generateSecret(): Promise<MfaSetupResponse> {
    return this.request<MfaSetupResponse>('/auth/mfa/setup', {
      method: 'POST',
    });
  }

  /**
   * Enable 2FA with verification code
   */
  async enable2FA(token: string): Promise<MfaEnableResponse> {
    return this.request<MfaEnableResponse>('/auth/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Disable 2FA
   */
  async disable2FA(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Verify 2FA token during login
   */
  async verifyToken(token: string): Promise<{ verified: boolean }> {
    return this.request<{ verified: boolean }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(token: string): Promise<MfaEnableResponse> {
    return this.request<MfaEnableResponse>('/auth/mfa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Get 2FA status
   */
  async getStatus(): Promise<MfaStatusResponse> {
    return this.request<MfaStatusResponse>('/auth/mfa/status', {
      method: 'GET',
    });
  }
}

// Export function to create instance
export function getTwoFactorApiClient(tokenProvider: () => string | null): TwoFactorApiClient {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return new TwoFactorApiClient(apiUrl, tokenProvider);
}
