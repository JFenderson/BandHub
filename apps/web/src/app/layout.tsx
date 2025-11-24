import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
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
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50">
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}