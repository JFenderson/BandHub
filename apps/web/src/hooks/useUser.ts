'use client';

import { useAuth } from './useAuth';

/**
 * Hook to get the current user
 * Returns null if not authenticated
 */
export function useUser() {
  const { user, isLoading } = useAuth();
  
  return {
    user,
    isLoading,
  };
}
