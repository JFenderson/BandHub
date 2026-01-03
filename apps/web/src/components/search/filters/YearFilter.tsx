'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

interface YearFilterProps {
  selected: number[];
  availableYears: number[];
  onChange: (years: number[]) => void;
  className?: string;
}

export function YearFilter({
  selected,
  availableYears,
  onChange,
  className = '',
}: YearFilterProps) {
  const [showAll, setShowAll] = useState(false);

  // Sort years in descending order (most recent first)
  const sortedYears = [...availableYears].sort((a, b) => b - a);
  
  // Show only recent years initially
  const recentYears = sortedYears.slice(0, 5);
  const displayYears = showAll ? sortedYears : recentYears;

  /**
   * Toggle year selection
   */
  const toggleYear = (year: number) => {
    if (selected.includes(year)) {
      onChange(selected.filter(y => y !== year));
    } else {
      onChange([...selected, year]);
    }
  };

  /**
   * Select year range
   */
  const selectRange = (startYear: number, endYear: number) => {
    const years = sortedYears.filter(
      year => year >= startYear && year <= endYear
    );
    onChange([...new Set([...selected, ...years])]);
  };

  /**
   * Clear all selections
   */
  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Year</h4>
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>

      {/* Quick ranges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => {
            const currentYear = new Date().getFullYear();
            selectRange(currentYear - 1, currentYear);
          }}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last 2 years
        </button>
        <button
          onClick={() => {
            const currentYear = new Date().getFullYear();
            selectRange(currentYear - 4, currentYear);
          }}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last 5 years
        </button>
        <button
          onClick={() => {
            const currentYear = new Date().getFullYear();
            selectRange(currentYear - 9, currentYear);
          }}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last 10 years
        </button>
      </div>

      {/* Years list */}
      <div className="space-y-1">
        {displayYears.map((year) => {
          const isSelected = selected.includes(year);
          
          return (
            <label
              key={year}
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
                onChange={() => toggleYear(year)}
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

              <span className="flex-1 text-sm text-gray-700 font-medium">
                {year}
              </span>

              {year === new Date().getFullYear() && (
                <span className="text-xs text-blue-600 font-medium">
                  Current
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Show more/less toggle */}
      {sortedYears.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 py-2 text-sm text-blue-600 hover:text-blue-700 
                   flex items-center justify-center gap-1 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show all {sortedYears.length} years
            </>
          )}
        </button>
      )}
    </div>
  );
}