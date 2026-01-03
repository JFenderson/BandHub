'use client';

import { Check } from 'lucide-react';
import { FilterOption } from '@/types/search';

interface ConferenceFilterProps {
  selected: string[];
  options: FilterOption[];
   onChange: (conferences: string[]) => void;  
  className?: string;
}

export function ConferenceFilter({
  selected,
  options,
  onChange,
  className = '',
}: ConferenceFilterProps) {
  /**
   * Toggle conference selection
   */
  const toggleConference = (conference: string) => {
    if (selected.includes(conference)) {
      onChange(selected.filter(id => id !== conference));
    } else {
      onChange([...selected, conference]);
    }
  };

  /**
   * Clear all selections
   */
  const clearAll = () => {
    onChange([]);
  };

  // Group conferences by popularity (if count is available)
  const sortedOptions = [...options].sort((a, b) => {
    if (a.count !== undefined && b.count !== undefined) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Conference</h4>
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>

      {/* Conferences list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sortedOptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No conferences available
          </p>
        ) : (
          sortedOptions.map((option) => {
            const isSelected = selected.includes(option.value);
            
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
                  onChange={() => toggleConference(option.value)}
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