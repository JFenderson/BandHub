'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { KeyboardShortcutsProvider } from '@/components/keyboard';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  // Admin routes don't show the main header/footer
  if (isAdminRoute) {
    return <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>;
  }

  // Regular routes show header/footer
  return (
    <KeyboardShortcutsProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main id="main-content" className="flex-1 bg-gray-50" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </div>
    </KeyboardShortcutsProvider>
  );
}
