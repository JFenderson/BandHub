'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CategoryFilter } from './filters/CategoryFilter';
import { YearFilter } from './filters/YearFilter';
import { ConferenceFilter } from './filters/ConferenceFilter';
import { DateRangeFilter } from './filters/DateRangeFilter';
import { LocationFilter } from './filters/LocationFilter';
import { FilterMetadata, VideoSearchQuery } from '@/types/search';
import { getFilterMetadata } from '@/lib/api/search';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  query: VideoSearchQuery;
  onFilterChange: (updates: Partial<VideoSearchQuery>) => void;
  onClearAll: () => void;
  activeFilterCount: number;
  className?: string;
}

export function FilterPanel({
  isOpen,
  onClose,
  query,
  onFilterChange,
  onClearAll,
  activeFilterCount,
  className = '',
}: FilterPanelProps) {
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['categories', 'years']) // Expand common filters by default
  );

  /**
   * Fetch filter metadata on mount
   */
  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingMetadata(true);
      try {
        const data = await getFilterMetadata();
        setMetadata(data);
      } catch (error) {
        console.error('Failed to fetch filter metadata:', error);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, []);

  /**
   * Toggle section expansion
   */
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  /**
   * Section header component
   */
  const SectionHeader = ({ 
    section, 
    title, 
    count 
  }: { 
    section: string; 
    title: string; 
    count?: number 
  }) => {
    const isExpanded = expandedSections.has(section);
    
    return (
      <button
        onClick={() => toggleSection(section)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 
                 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Filter Panel */}
      <aside
        className={`fixed lg:sticky top-0 right-0 lg:right-auto h-screen lg:h-auto 
                  w-80 lg:w-full bg-white z-50 lg:z-auto overflow-y-auto
                  shadow-xl lg:shadow-none border-l lg:border-l-0 lg:border 
                  lg:border-gray-200 lg:rounded-xl animate-slide-in-right lg:animate-none
                  ${className}`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Clear all
              </button>
            )}
            
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoadingMetadata && !metadata && (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="space-y-2">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-8 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {metadata && (
          <div className="p-4 space-y-1">
            {/* Categories */}
            <div className="border-b border-gray-100 pb-1">
              <SectionHeader
                section="categories"
                title="Categories"
                count={query.categoryIds?.length}
              />
              {expandedSections.has('categories') && (
                <div className="px-3 pb-3">
                  <CategoryFilter
                    selected={query.categoryIds || []}
                    options={metadata.categories}
                    onChange={(categoryIds) => 
                      onFilterChange({ categoryIds: categoryIds.length > 0 ? categoryIds : undefined })
                    }
                  />
                </div>
              )}
            </div>

            {/* Years */}
            <div className="border-b border-gray-100 pb-1">
              <SectionHeader
                section="years"
                title="Year"
                count={query.years?.length}
              />
              {expandedSections.has('years') && (
                <div className="px-3 pb-3">
                  <YearFilter
                    selected={query.years || []}
                    availableYears={metadata.years}
                    onChange={(years) => 
                      onFilterChange({ years: years.length > 0 ? years : undefined })
                    }
                  />
                </div>
              )}
            </div>

            {/* Conferences */}
            <div className="border-b border-gray-100 pb-1">
              <SectionHeader
                section="conferences"
                title="Conference"
                count={query.conferences?.length}
              />
              {expandedSections.has('conferences') && (
                <div className="px-3 pb-3">
                  <ConferenceFilter
                    selected={query.conferences || []}
                    options={metadata.conferences}
                    onChange={(conferences) => 
                      onFilterChange({ conferences: conferences.length > 0 ? conferences : undefined })
                    }
                  />
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="border-b border-gray-100 pb-1">
              <SectionHeader
                section="dateRange"
                title="Event Date"
                count={query.dateFrom || query.dateTo ? 1 : 0}
              />
              {expandedSections.has('dateRange') && (
                <div className="px-3 pb-3">
                  <DateRangeFilter
                    dateFrom={query.dateFrom}
                    dateTo={query.dateTo}
                    onChange={(dateFrom, dateTo) => 
                      onFilterChange({ dateFrom, dateTo })
                    }
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="border-b border-gray-100 pb-1">
              <SectionHeader
                section="location"
                title="Location"
                count={(query.states?.length || 0) + (query.regions?.length || 0)}
              />
              {expandedSections.has('location') && (
                <div className="px-3 pb-3">
                  <LocationFilter
                    selectedStates={query.states || []}
                    selectedRegions={query.regions || []}
                    stateOptions={metadata.states}
                    regionOptions={metadata.regions}
                    onStatesChange={(states) => 
                      onFilterChange({ states: states.length > 0 ? states : undefined })
                    }
                    onRegionsChange={(regions) => 
                      onFilterChange({ regions: regions.length > 0 ? regions : undefined })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Apply Button */}
        <div className="lg:hidden sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg
                     hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </aside>
    </>
  );
}