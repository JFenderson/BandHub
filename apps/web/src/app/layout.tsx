import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import { PWAWrapper } from '@/components/pwa';
import './globals.css';

export const metadata: Metadata = {
  title: 'HBCU Band Hub',
  description: 'Discover and celebrate the excellence of HBCU marching bands',
  keywords: ['HBCU', 'marching band', 'college bands', 'music', 'performance'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HBCU Band Hub',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#dc2626',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
              <PWAWrapper>
                <ConditionalLayout>
                  {children}
                </ConditionalLayout>
              </PWAWrapper>
            </UserProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}