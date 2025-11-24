'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

/**
 * Hook to require authentication for a page
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectUrl: string = '/admin/login') {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // Redirect if not authenticated
    if (!isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, isLoading, router, redirectUrl]);

  return {
    isAuthenticated,
    isLoading,
  };
}
