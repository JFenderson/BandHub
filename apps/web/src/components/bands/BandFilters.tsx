'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const US_STATES = [
  'Alabama', 'Arkansas', 'Delaware', 'District of Columbia', 'Florida', 
  'Georgia', 'Louisiana', 'Maryland', 'Mississippi', 'Missouri', 
  'North Carolina', 'Ohio', 'Oklahoma', 'Pennsylvania', 'South Carolina',
  'Tennessee', 'Texas', 'Virginia', 'West Virginia'
];

export function BandFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('search') || '';
  const currentState = searchParams.get('state') || '';

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to page 1 when filters change
    params.delete('page');

    startTransition(() => {
      router.push(`/bands?${params.toString()}`);
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search Bands
          </label>
          <input
            id="search"
            type="text"
            defaultValue={currentSearch}
            onChange={(e) => updateFilters('search', e.target.value)}
            placeholder="Search by name or nickname..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* State Filter */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <select
            id="state"
            value={currentState}
            onChange={(e) => updateFilters('state', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All States</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters */}
      {(currentSearch || currentState) && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {currentSearch && (
            <button
              onClick={() => updateFilters('search', '')}
              className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm hover:bg-primary-200"
            >
              {currentSearch}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {currentState && (
            <button
              onClick={() => updateFilters('state', '')}
              className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm hover:bg-primary-200"
            >
              {currentState}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}