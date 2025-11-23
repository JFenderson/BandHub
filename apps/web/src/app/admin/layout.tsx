import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata = {
  title: 'Admin Dashboard - HBCU Band Hub',
  description: 'Admin dashboard for managing HBCU Band Hub content',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication guard: require admin access
  try {
    await requireAdmin();
  } catch (error) {
    // TODO: Replace with redirect to login page when authentication is implemented
    // For now, redirect to home page with error message in query params
    // In production, this should redirect to a login page with returnUrl
    console.error('Admin access denied:', error);
    redirect('/?error=admin_access_required');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Admin Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-6 py-4">
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage bands, videos, events, and categories
              </p>
            </div>
          </header>
          
          {/* Page content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
