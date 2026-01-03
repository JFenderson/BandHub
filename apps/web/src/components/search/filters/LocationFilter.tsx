'use client';

import { useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import { FilterOption } from '@/types/search';

interface LocationFilterProps {
  selectedStates: string[];
  selectedRegions: string[];
  stateOptions: FilterOption[];
  regionOptions: FilterOption[];
  onStatesChange: (states: string[]) => void;
  onRegionsChange: (regions: string[]) => void;
  className?: string;
}

type LocationTab = 'states' | 'regions';

export function LocationFilter({
  selectedStates,
  selectedRegions,
  stateOptions,
  regionOptions,
  onStatesChange,
  onRegionsChange,
  className = '',
}: LocationFilterProps) {
  const [activeTab, setActiveTab] = useState<LocationTab>('states');
  const [searchTerm, setSearchTerm] = useState('');

  const hasActiveFilters = selectedStates.length > 0 || selectedRegions.length > 0;

  /**
   * Toggle state selection
   */
  const toggleState = (stateCode: string) => {
    if (selectedStates.includes(stateCode)) {
      onStatesChange(selectedStates.filter(s => s !== stateCode));
    } else {
      onStatesChange([...selectedStates, stateCode]);
    }
  };

  /**
   * Toggle region selection
   */
  const toggleRegion = (regionId: string) => {
    if (selectedRegions.includes(regionId)) {
      onRegionsChange(selectedRegions.filter(r => r !== regionId));
    } else {
      onRegionsChange([...selectedRegions, regionId]);
    }
  };

  /**
   * Clear all location filters
   */
  const clearAll = () => {
    onStatesChange([]);
    onRegionsChange([]);
  };

  // Filter options based on search
  const filteredStates = stateOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredRegions = regionOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentOptions = activeTab === 'states' ? filteredStates : filteredRegions;
  const currentSelected = activeTab === 'states' ? selectedStates : selectedRegions;
  const toggleFn = activeTab === 'states' ? toggleState : toggleRegion;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location
        </h4>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Clear ({selectedStates.length + selectedRegions.length})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveTab('states')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'states'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          States
          {selectedStates.length > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {selectedStates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('regions')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'regions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Regions
          {selectedRegions.length > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {selectedRegions.length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      {currentOptions.length > 5 && (
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100
                   mb-3"
        />
      )}

      {/* Options list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {currentOptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No {activeTab} found
          </p>
        ) : (
          currentOptions.map((option) => {
            const isSelected = currentSelected.includes(option.value);
            
            return (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer
                         transition-colors ${
                  isSelected
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleFn(option.value)}
                  className="sr-only"
                />
                
                {/* Custom checkbox */}
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center 
                           justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>

                <span className="flex-1 text-sm text-gray-700">
                  {option.label}
                </span>

                {option.count !== undefined && (
                  <span className="text-xs text-gray-400">
                    {option.count.toLocaleString()}
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}