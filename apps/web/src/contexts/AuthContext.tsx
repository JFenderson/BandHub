'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthContextType, User, LoginCredentials } from '@/types/auth';
import { apiClient } from '@/lib/api-client';
import { setAuthTokens, clearAuthTokens, getAccessToken, getRefreshToken } from '@/lib/auth-actions';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * Handle logout cleanup
   */
  const handleLogout = useCallback(async () => {
    // Clear tokens from cookies
    await clearAuthTokens();

    // Clear API client tokens
    apiClient.setAccessToken(null);
    apiClient.setRefreshToken(null);

    // Clear user state
    setUser(null);
    setIsLoading(false);

    // Redirect to login
    router.push('/admin/login');
  }, [router]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();

        if (accessToken && refreshToken) {
          // Set tokens in API client
          apiClient.setAccessToken(accessToken);
          apiClient.setRefreshToken(refreshToken);

          // Decode user from token (JWT payload)
          const tokenPayload = parseJwt(accessToken);
          if (tokenPayload) {
            setUser({
              id: tokenPayload.sub,
              email: tokenPayload.email,
              name: tokenPayload.name || tokenPayload.email,
              role: tokenPayload.role,
            });
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        // Clear invalid tokens
        await clearAuthTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Set up unauthorized callback for API client
   */
  useEffect(() => {
    apiClient.setOnUnauthorized(handleLogout);
  }, [handleLogout]);

  /**
   * Login with credentials
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await apiClient.login(credentials);

      // Store tokens in httpOnly cookies via server action
      await setAuthTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      });

      // Set tokens in API client
      apiClient.setAccessToken(response.accessToken);
      apiClient.setRefreshToken(response.refreshToken);

      // Set user state
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Call logout endpoint
      await apiClient.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      await handleLogout();
    }
  }, [handleLogout]);

  /**
   * Refresh access token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await apiClient.refreshAccessToken();

      // Store new tokens
      await setAuthTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      });

      // Update API client
      apiClient.setAccessToken(response.accessToken);
      apiClient.setRefreshToken(response.refreshToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      await handleLogout();
      throw error;
    }
  }, [handleLogout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Parse JWT token (simple base64 decode)
 * Note: This is not a security validation, just for reading the payload
 * The actual token validation happens on the backend
 * We don't check expiration here because:
 * 1. The backend validates on each request
 * 2. We have automatic token refresh on 401
 * 3. Checking expiration client-side could cause timing issues
 */
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}
