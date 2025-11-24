'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Protected Route Wrapper
 * Requires authentication to access the wrapped content
 * Shows loading spinner while checking auth
 * Redirects to login if not authenticated
 */
export function ProtectedRoute({ children, redirectTo = '/admin/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useRequireAuth(redirectTo);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated (redirect will happen via useRequireAuth)
  if (!isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
