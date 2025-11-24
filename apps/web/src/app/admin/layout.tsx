'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  // Login page doesn't need protection or admin layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // All other admin pages need protection and the admin layout
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <div className="flex">
          {/* Sidebar */}
          <AdminSidebar />
          
          {/* Main content area */}
          <div className="flex-1 flex flex-col">
            {/* Admin Header with user info and logout */}
            <AdminHeader />
            
            {/* Page content */}
            <main className="flex-1 p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
