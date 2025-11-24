'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Band {
  id: string;
  name: string;
  slug: string;
  _count: { videos: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { videos: number };
}

interface FilterSidebarProps {
  onFiltersChange?: (filters: Record<string, string>) => void;
  className?: string;
}

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom' | '';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const DURATION_OPTIONS = [
  { value: '', label: 'Any Length' },
  { value: 'short', label: 'Short (< 5 min)' },
  { value: 'medium', label: 'Medium (5-20 min)' },
  { value: 'long', label: 'Long (> 20 min)' },
];

export function FilterSidebar({ onFiltersChange, className = '' }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for filter options
  const [bands, setBands] = useState<Band[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bandSearch, setBandSearch] = useState('');

  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState({
    contentType: true,
    bands: true,
    dateRange: false,
    duration: false,
    viewCount: false,
    opponent: false,
  });

  // State for filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const param = searchParams.get('categoryIds');
    return param ? param.split(',') : [];
  });
  const [selectedBands, setSelectedBands] = useState<string[]>(() => {
    const param = searchParams.get('bandIds');
    return param ? param.split(',') : [];
  });
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    if (searchParams.get('dateFrom') || searchParams.get('dateTo')) return 'custom';
    return '';
  });
  const [customDateFrom, setCustomDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [customDateTo, setCustomDateTo] = useState(searchParams.get('dateTo') || '');
  const [duration, setDuration] = useState(searchParams.get('duration') || '');
  const [viewCountMin, setViewCountMin] = useState(searchParams.get('viewCountMin') || '');
  const [viewCountMax, setViewCountMax] = useState(searchParams.get('viewCountMax') || '');
  const [hasOpponent, setHasOpponent] = useState<boolean | null>(() => {
    const param = searchParams.get('hasOpponent');
    if (param === 'true') return true;
    if (param === 'false') return false;
    return null;
  });

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/search/filters`);
        if (response.ok) {
          const data = await response.json();
          setBands(data.bands || []);
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilterOptions();
  }, []);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getDateRange = (preset: DatePreset): { dateFrom?: string; dateTo?: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return {
          dateFrom: today.toISOString(),
          dateTo: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
        };
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          dateFrom: weekAgo.toISOString(),
          dateTo: now.toISOString(),
        };
      case 'month':
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          dateFrom: monthAgo.toISOString(),
          dateTo: now.toISOString(),
        };
      case 'year':
        const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        return {
          dateFrom: yearAgo.toISOString(),
          dateTo: now.toISOString(),
        };
      case 'custom':
        return {
          dateFrom: customDateFrom ? new Date(customDateFrom).toISOString() : undefined,
          dateTo: customDateTo ? new Date(customDateTo).toISOString() : undefined,
        };
      default:
        return {};
    }
  };

  const getDurationRange = (dur: string): { durationMin?: number; durationMax?: number } => {
    switch (dur) {
      case 'short':
        return { durationMax: 300 }; // < 5 min
      case 'medium':
        return { durationMin: 300, durationMax: 1200 }; // 5-20 min
      case 'long':
        return { durationMin: 1200 }; // > 20 min
      default:
        return {};
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);

    // Clear existing filter params
    ['categoryIds', 'bandIds', 'dateFrom', 'dateTo', 'durationMin', 'durationMax', 'viewCountMin', 'viewCountMax', 'hasOpponent'].forEach(
      (key) => params.delete(key)
    );

    // Reset to page 1
    params.delete('page');

    // Add selected categories
    if (selectedCategories.length > 0) {
      params.set('categoryIds', selectedCategories.join(','));
    }

    // Add selected bands
    if (selectedBands.length > 0) {
      params.set('bandIds', selectedBands.join(','));
    }

    // Add date range
    const dateRange = getDateRange(datePreset);
    if (dateRange.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange.dateTo) params.set('dateTo', dateRange.dateTo);

    // Add duration
    const durationRange = getDurationRange(duration);
    if (durationRange.durationMin) params.set('durationMin', durationRange.durationMin.toString());
    if (durationRange.durationMax) params.set('durationMax', durationRange.durationMax.toString());

    // Add view count
    if (viewCountMin) params.set('viewCountMin', viewCountMin);
    if (viewCountMax) params.set('viewCountMax', viewCountMax);

    // Add opponent filter
    if (hasOpponent !== null) {
      params.set('hasOpponent', hasOpponent.toString());
    }

    const queryString = params.toString();
    router.push(`/search${queryString ? `?${queryString}` : ''}`);

    if (onFiltersChange) {
      const filtersObj: Record<string, string> = {};
      params.forEach((value, key) => {
        filtersObj[key] = value;
      });
      onFiltersChange(filtersObj);
    }
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedBands([]);
    setDatePreset('');
    setCustomDateFrom('');
    setCustomDateTo('');
    setDuration('');
    setViewCountMin('');
    setViewCountMax('');
    setHasOpponent(null);

    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);

    const queryString = params.toString();
    router.push(`/search${queryString ? `?${queryString}` : ''}`);

    if (onFiltersChange) {
      onFiltersChange(q ? { q } : {});
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategories.length > 0) count++;
    if (selectedBands.length > 0) count++;
    if (datePreset) count++;
    if (duration) count++;
    if (viewCountMin || viewCountMax) count++;
    if (hasOpponent !== null) count++;
    return count;
  };

  const filteredBands = bands.filter((band) =>
    band.name.toLowerCase().includes(bandSearch.toLowerCase())
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {getActiveFiltersCount() > 0 && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {getActiveFiltersCount()} active
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Content Type Section */}
        <div className="border-b border-gray-100 pb-4">
          <button
            onClick={() => toggleSection('contentType')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">Content Type</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.contentType ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.contentType && (
            <div className="mt-3 space-y-2">
              {VIDEO_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories([...selectedCategories, category]);
                      } else {
                        setSelectedCategories(selectedCategories.filter((c) => c !== category));
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{VIDEO_CATEGORY_LABELS[category]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Bands Section */}
        <div className="border-b border-gray-100 pb-4">
          <button
            onClick={() => toggleSection('bands')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">Bands</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.bands ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.bands && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                placeholder="Search bands..."
                value={bandSearch}
                onChange={(e) => setBandSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {isLoading ? (
                  <div className="text-sm text-gray-500 py-2">Loading bands...</div>
                ) : (
                  filteredBands.slice(0, 20).map((band) => (
                    <label key={band.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={selectedBands.includes(band.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBands([...selectedBands, band.id]);
                          } else {
                            setSelectedBands(selectedBands.filter((b) => b !== band.id));
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 flex-1 truncate">{band.name}</span>
                      <span className="text-xs text-gray-400">({band._count.videos})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date Range Section */}
        <div className="border-b border-gray-100 pb-4">
          <button
            onClick={() => toggleSection('dateRange')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">Date Range</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.dateRange ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.dateRange && (
            <div className="mt-3 space-y-3">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {datePreset === 'custom' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duration Section */}
        <div className="border-b border-gray-100 pb-4">
          <button
            onClick={() => toggleSection('duration')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">Video Length</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.duration ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.duration && (
            <div className="mt-3 space-y-2">
              {DURATION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value={option.value}
                    checked={duration === option.value}
                    onChange={(e) => setDuration(e.target.value)}
                    className="border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* View Count Section */}
        <div className="border-b border-gray-100 pb-4">
          <button
            onClick={() => toggleSection('viewCount')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">View Count</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.viewCount ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.viewCount && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Min</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={viewCountMin}
                    onChange={(e) => setViewCountMin(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Max</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={viewCountMax}
                    onChange={(e) => setViewCountMax(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Has Opponent Section */}
        <div>
          <button
            onClick={() => toggleSection('opponent')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-900">Opponent Band</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.opponent ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.opponent && (
            <div className="mt-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setHasOpponent(hasOpponent === true ? null : true)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hasOpponent === true ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hasOpponent === true ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">Only show videos with opponent bands</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Chips */}
      {getActiveFiltersCount() > 0 && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">Active Filters</div>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
              >
                {VIDEO_CATEGORY_LABELS[cat as keyof typeof VIDEO_CATEGORY_LABELS] || cat}
                <button
                  onClick={() => setSelectedCategories(selectedCategories.filter((c) => c !== cat))}
                  className="hover:text-primary-900"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {selectedBands.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {selectedBands.length} band{selectedBands.length > 1 ? 's' : ''} selected
                <button
                  onClick={() => setSelectedBands([])}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {datePreset && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                {DATE_PRESETS.find((p) => p.value === datePreset)?.label}
                <button
                  onClick={() => {
                    setDatePreset('');
                    setCustomDateFrom('');
                    setCustomDateTo('');
                  }}
                  className="hover:text-green-900"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {duration && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                {DURATION_OPTIONS.find((d) => d.value === duration)?.label}
                <button
                  onClick={() => setDuration('')}
                  className="hover:text-yellow-900"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={applyFilters}
          className="w-full py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Apply Filters
        </button>
        {getActiveFiltersCount() > 0 && (
          <button
            onClick={resetFilters}
            className="w-full py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
          >
            Reset All Filters
          </button>
        )}
      </div>
    </div>
  );
}
