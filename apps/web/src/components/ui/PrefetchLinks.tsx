'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PrefetchLinksProps {
  links: string[];
}

/**
 * Component to prefetch likely next pages for better navigation performance
 * Uses Next.js router.prefetch() to preload pages the user is likely to visit
 */
export function PrefetchLinks({ links }: PrefetchLinksProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Prefetch links after a short delay to avoid blocking initial page load
    const timer = setTimeout(() => {
      links.forEach((link) => {
        router.prefetch(link);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [links, router, mounted]);

  return null;
}

/**
 * Hook to prefetch routes based on user interaction hints
 */
export function usePrefetchOnHover(href: string) {
  const router = useRouter();

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  return { onMouseEnter: handleMouseEnter };
}
