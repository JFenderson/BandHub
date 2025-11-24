'use client';

import { useAuth as useAuthContext } from '@/contexts/AuthContext';

/**
 * Hook to access auth context
 * Re-export for convenience
 */
export function useAuth() {
  return useAuthContext();
}
