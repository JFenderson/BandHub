import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
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
        <AuthProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </AuthProvider>
      </body>
    </html>
  );
}