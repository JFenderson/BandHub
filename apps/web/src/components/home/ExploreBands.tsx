'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { BandCard } from '@/components/bands/BandCard';
import type { Band } from '@/types/api';

interface ExploreBandsProps {
  initialBands: Band[];
}

export function ExploreBands({ initialBands }: ExploreBandsProps) {
  const [bands, setBands] = useState<Band[]>(initialBands);

  useEffect(() => {
    if (initialBands.length === 0) {
      apiClient
        .getBands({ limit: 10 })
        .then((r) => setBands(r.data))
        .catch(() => {});
    }
  }, [initialBands.length]);

  if (bands.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No bands available yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bands.map((band) => (
        <BandCard key={band.id} band={band} />
      ))}
    </div>
  );
}
