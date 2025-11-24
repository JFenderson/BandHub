'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

export function AdminHeader() {
  const { logout } = useAuth();
  const { user } = useUser();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage bands, videos, events, and categories
          </p>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-4">
          {user && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ').toLowerCase()}</p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            aria-label="Logout"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
