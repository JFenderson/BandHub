'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { FilterOption } from '@/types/search';

interface CategoryFilterProps {
  selected: string[];
  options: FilterOption[];
  onChange: (categoryIds: string[]) => void;
  className?: string;
}

export function CategoryFilter({
  selected,
  options,
  onChange,
  className = '',
}: CategoryFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Filter options based on search term
   */
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Toggle category selection
   */
  const toggleCategory = (categoryId: string) => {
    if (selected.includes(categoryId)) {
      onChange(selected.filter(id => id !== categoryId));
    } else {
      onChange([...selected, categoryId]);
    }
  };

  /**
   * Select all categories
   */
  const selectAll = () => {
    onChange(filteredOptions.map(opt => opt.value));
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
        <h4 className="font-medium text-gray-900">Categories</h4>
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>

      {/* Search input */}
      {options.length > 5 && (
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search categories..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100
                   mb-3"
        />
      )}

      {/* Quick actions */}
      {!searchTerm && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                     transition-colors"
          >
            Select all
          </button>
        </div>
      )}

      {/* Options list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filteredOptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No categories found
          </p>
        ) : (
          filteredOptions.map((option) => {
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
                  onChange={() => toggleCategory(option.value)}
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