'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { BandCard } from './BandCard';
import { Pagination } from '@/components/ui/Pagination';
import type { Band } from '@/types/api';

interface BandGridProps {
  initialBands: Band[];
  initialMeta: { total: number; page: number; totalPages: number };
}

export function BandGrid({ initialBands, initialMeta }: BandGridProps) {
  const searchParams = useSearchParams();
  const [bands, setBands] = useState<Band[]>(initialBands);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(initialBands.length === 0);

  const fetchBands = useCallback(async () => {
    const search = searchParams?.get('search') || undefined;
    const state = searchParams?.get('state') || undefined;
    const conference = searchParams?.get('conference') || undefined;
    const page = parseInt(searchParams?.get('page') || '1');

    try {
      setLoading(true);
      const result = await apiClient.getBands({ search, state, conference, page, limit: 12 });
      setBands(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error('Failed to fetch bands:', error);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (bands.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No bands found</h3>
        <p className="mt-2 text-gray-500">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {bands.map((band) => (
          <BandCard key={band.id} band={band} />
        ))}
      </div>
      <Pagination currentPage={meta.page} totalPages={meta.totalPages} baseUrl="/bands" />
    </>
  );
}
