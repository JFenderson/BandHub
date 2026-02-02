'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import PWAProvider with SSR disabled
const PWAProviderClient = dynamic(
  () => import('./PWAProvider').then((mod) => mod.PWAProvider),
  { ssr: false }
);

interface PWAWrapperProps {
  children: ReactNode;
}

export function PWAWrapper({ children }: PWAWrapperProps) {
  return <PWAProviderClient>{children}</PWAProviderClient>;
}
