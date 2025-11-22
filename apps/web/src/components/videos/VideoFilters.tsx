'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useEffect, useState } from 'react';
import type { Band, VideoCategory } from '@/types/api';

const CATEGORIES: VideoCategory[] = [
  'FIFTH_QUARTER',
  'FIELD_SHOW',
  'STAND_BATTLE',
  'PARADE',
  'PRACTICE',
  'CONCERT_BAND',
];

const CATEGORY_LABELS: Record<VideoCategory, string> = {
  FIFTH_QUARTER: '5th Quarter',
  FIELD_SHOW: 'Field Show',
  STAND_BATTLE: 'Stand Battle',
  PARADE: 'Parade',
  PRACTICE: 'Practice',
  CONCERT_BAND: 'Concert Band',
};

interface VideoFiltersProps {
  bands: Band[];
}

export function VideoFilters({ bands }: VideoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
 const [categories, setCategories] = useState<any[]>([]);
 
  const currentSearch = searchParams.get('search') || '';
  const currentBandId = searchParams.get('bandId') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentYear = searchParams.get('year') || '';

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Failed to fetch categories:', err));
  }, []);


  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to page 1 when filters change
    params.delete('page');

    startTransition(() => {
      router.push(`/videos?${params.toString()}`);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('/videos');
    });
  };

  // Generate year options (current year back to 2010)
  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: currentYearNum - 2009 }, (_, i) => currentYearNum - i);

  const hasActiveFilters = currentSearch || currentBandId || currentCategory || currentYear;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search Videos
          </label>
          <input
            id="search"
            type="text"
            defaultValue={currentSearch}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search titles, descriptions..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Band Filter */}
        <div>
          <label htmlFor="band" className="block text-sm font-medium text-gray-700 mb-1">
            Band
          </label>
          <select
            id="band"
            value={currentBandId}
            onChange={(e) => updateFilter('bandId', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Bands</option>
            {bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={currentCategory}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <select
            id="year"
            value={currentYear}
            onChange={(e) => updateFilter('year', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters with Clear All */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Active filters:</span>
              
              {currentSearch && (
                <FilterChip
                  label={`Search: ${currentSearch}`}
                  onRemove={() => updateFilter('search', '')}
                />
              )}
              
              {currentBandId && (
                <FilterChip
                  label={`Band: ${bands.find(b => b.id === currentBandId)?.name || 'Unknown'}`}
                  onRemove={() => updateFilter('bandId', '')}
                />
              )}
              
              {currentCategory && (
                <FilterChip
                  label={`Category: ${CATEGORY_LABELS[currentCategory as VideoCategory]}`}
                  onRemove={() => updateFilter('category', '')}
                />
              )}
              
              {currentYear && (
                <FilterChip
                  label={`Year: ${currentYear}`}
                  onRemove={() => updateFilter('year', '')}
                />
              )}
            </div>

            <button
              onClick={clearAllFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter chip component
interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm hover:bg-primary-200 transition-colors"
    >
      <span>{label}</span>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}