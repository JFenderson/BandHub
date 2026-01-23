import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import './globals.css';

export const metadata: Metadata = {
  title: 'HBCU Band Hub',
  description: 'Discover and celebrate the excellence of HBCU marching bands',
  keywords: ['HBCU', 'marching band', 'college bands', 'music', 'performance'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            <UserProvider>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </UserProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}