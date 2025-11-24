'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { 
  UserContextType, 
  UserProfile, 
  UserLoginCredentials, 
  UserRegistrationData,
  UpdateUserProfile 
} from '@/types/user';
import { userApiClient } from '@/lib/api/users';

const UserContext = createContext<UserContextType | undefined>(undefined);

// Cookie utilities
const setCookie = (name: string, value: string, days: number) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
};

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
};

interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * Clear auth state
   */
  const clearAuth = useCallback(() => {
    deleteCookie('user_access_token');
    deleteCookie('user_session_token');
    userApiClient.setAccessToken(null);
    userApiClient.setSessionToken(null);
    setUser(null);
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = getCookie('user_access_token');
        const sessionToken = getCookie('user_session_token');

        if (accessToken && sessionToken) {
          userApiClient.setAccessToken(accessToken);
          userApiClient.setSessionToken(sessionToken);

          // Fetch user profile
          const profile = await userApiClient.getProfile();
          setUser(profile);
        }
      } catch (error) {
        console.error('Failed to initialize user auth:', error);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [clearAuth]);

  /**
   * Register new user
   */
  const register = useCallback(async (data: UserRegistrationData) => {
    try {
      setIsLoading(true);
      await userApiClient.register(data);
      // Don't auto-login after registration - user needs to verify email
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (credentials: UserLoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await userApiClient.login(credentials);

      // Store tokens in cookies
      const days = credentials.rememberMe ? 30 : 7;
      setCookie('user_access_token', response.accessToken, days);
      setCookie('user_session_token', response.sessionToken, days);

      // Fetch full profile
      const profile = await userApiClient.getProfile();
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await userApiClient.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearAuth();
      setIsLoading(false);
      router.push('/login');
    }
  }, [clearAuth, router]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (data: UpdateUserProfile) => {
    const updatedProfile = await userApiClient.updateProfile(data);
    setUser(prev => prev ? { ...prev, ...updatedProfile } : null);
  }, []);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    try {
      const profile = await userApiClient.getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      clearAuth();
    }
  }, [clearAuth]);

  const value: UserContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    refreshUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Hook to use user context
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
