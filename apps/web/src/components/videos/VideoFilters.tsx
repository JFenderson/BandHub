'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useEffect, useState } from 'react';
import type { Band } from '@/types/api';
import { VideoCategory, VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';
import { apiClient } from '@/lib/api-client';

interface VideoFiltersProps {
  bands?: Band[];
  initialFilters?: {
    bandId?: string;
    category?: VideoCategory;
    eventYear?: number;
    search?: string;
  };
}

export function VideoFilters({ bands }: VideoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<any[]>([]);
 
  const currentSearch = searchParams.get('search') || '';
  const currentBandId = searchParams.get('bandId') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentEventYear = searchParams.get('eventYear') || '';
  const currentSortBy = searchParams.get('sortBy') || 'publishedAt';

  useEffect(() => {
    apiClient.getCategories()
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

  // Generate eventYear options (current eventYear back to 2010)
  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: currentYearNum - 2009 }, (_, i) => currentYearNum - i);

  const hasActiveFilters = currentSearch || currentBandId || currentCategory || currentEventYear || currentSortBy !== 'publishedAt';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            {VIDEO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {VIDEO_CATEGORY_LABELS[category]}
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
            id="eventYear"
            value={currentEventYear}
            onChange={(e) => updateFilter('eventYear', e.target.value)}
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

        {/* Sort By Filter */}
        <div>
          <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            id="sortBy"
            value={currentSortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="publishedAt">Latest Uploads</option>
            <option value="createdAt">Recently Added</option>
            <option value="viewCount">Most Viewed</option>
            <option value="title">Title (A-Z)</option>
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
                  label={`Category: ${VIDEO_CATEGORY_LABELS[currentCategory as VideoCategory]}`}
                  onRemove={() => updateFilter('category', '')}
                />
              )}
              
              {currentEventYear && (
                <FilterChip
                  label={`Year: ${currentEventYear}`}
                  onRemove={() => updateFilter('eventYear', '')}
                />
              )}

              {currentSortBy !== 'publishedAt' && (
                <FilterChip
                  label={`Sort: ${getSortLabel(currentSortBy)}`}
                  onRemove={() => updateFilter('sortBy', 'publishedAt')}
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

// Helper function to get sort label
function getSortLabel(sortBy: string): string {
  const labels: Record<string, string> = {
    publishedAt: 'Latest Uploads',
    createdAt: 'Recently Added',
    viewCount: 'Most Viewed',
    title: 'Title (A-Z)',
  };
  return labels[sortBy] || sortBy;
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