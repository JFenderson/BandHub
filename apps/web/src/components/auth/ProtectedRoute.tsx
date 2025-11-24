'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, requireVerified = false }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Store the current path to redirect back after login
        const currentPath = window.location.pathname;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else if (requireVerified && user && !user.emailVerified) {
        router.push('/profile?verify=true');
      }
    }
  }, [isAuthenticated, isLoading, user, requireVerified, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Don't render if email verification is required but not verified
  if (requireVerified && user && !user.emailVerified) {
    return null;
  }

  return <>{children}</>;
}
