'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';
import type { VideoCategory } from '@hbcu-band-hub/shared-types';

interface CreatorVideoFiltersProps {
  creatorId: string;
  bands: { id: string; name: string }[];
}

export function CreatorVideoFilters({ creatorId, bands }: CreatorVideoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentBandId = searchParams?.get('bandId') || '';
  const currentCategory = searchParams?.get('category') || '';
  const currentYear = searchParams?.get('year') || '';
  const currentSearch = searchParams?.get('search') || '';
  const currentSortBy = searchParams?.get('sortBy') || 'publishedAt';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    startTransition(() => {
      router.push(`/creators/${creatorId}?${params.toString()}`);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push(`/creators/${creatorId}`);
    });
  };

  const currentYear_ = new Date().getFullYear();
  const years = Array.from({ length: currentYear_ - 1989 }, (_, i) => currentYear_ - i);

  const hasActiveFilters = currentBandId || currentCategory || currentYear || currentSearch || currentSortBy !== 'publishedAt';

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-5 mb-6 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            defaultValue={currentSearch}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder="Search videos..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Band */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Band</label>
          <select
            value={currentBandId}
            onChange={e => updateFilter('bandId', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Bands</option>
            {bands.map(band => (
              <option key={band.id} value={band.id}>{band.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={currentCategory}
            onChange={e => updateFilter('category', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {VIDEO_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{VIDEO_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select
            value={currentYear}
            onChange={e => updateFilter('year', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Years</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={currentSortBy}
            onChange={e => updateFilter('sortBy', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="publishedAt">Latest First</option>
            <option value="viewCount">Most Viewed</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Active:</span>
          {currentSearch && <Chip label={`"${currentSearch}"`} onRemove={() => updateFilter('search', '')} />}
          {currentBandId && <Chip label={`Band: ${bands.find(b => b.id === currentBandId)?.name ?? '...'}`} onRemove={() => updateFilter('bandId', '')} />}
          {currentCategory && <Chip label={VIDEO_CATEGORY_LABELS[currentCategory as VideoCategory] ?? currentCategory} onRemove={() => updateFilter('category', '')} />}
          {currentYear && <Chip label={currentYear} onRemove={() => updateFilter('year', '')} />}
          {currentSortBy !== 'publishedAt' && <Chip label={`Sort: ${currentSortBy}`} onRemove={() => updateFilter('sortBy', 'publishedAt')} />}
          <button onClick={clearAll} className="text-xs text-primary-600 hover:text-primary-800 ml-auto font-medium">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full text-xs hover:bg-primary-200 transition-colors"
    >
      {label}
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
