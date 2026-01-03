'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (dateFrom?: string, dateTo?: string) => void;
  className?: string;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
  className = '',
}: DateRangeFilterProps) {
  const [localFrom, setLocalFrom] = useState(dateFrom || '');
  const [localTo, setLocalTo] = useState(dateTo || '');

  /**
   * Apply date range
   */
  const applyDateRange = () => {
    onChange(
      localFrom || undefined,
      localTo || undefined
    );
  };

  /**
   * Clear date range
   */
  const clearDateRange = () => {
    setLocalFrom('');
    setLocalTo('');
    onChange(undefined, undefined);
  };

  /**
   * Set quick date range presets
   */
  const setPreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate: string;

    switch (preset) {
      case 'today':
        startDate = endDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
    }

    setLocalFrom(startDate);
    setLocalTo(endDate);
    onChange(startDate, endDate);
  };

  const hasActiveRange = dateFrom || dateTo;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Event Date Range
        </h4>
        {hasActiveRange && (
          <button
            onClick={clearDateRange}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setPreset('week')}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last week
        </button>
        <button
          onClick={() => setPreset('month')}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last month
        </button>
        <button
          onClick={() => setPreset('year')}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Last year
        </button>
        <button
          onClick={() => setPreset('today')}
          className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50
                   transition-colors"
        >
          Today
        </button>
      </div>

      {/* Date inputs */}
      <div className="space-y-3">
        {/* From date */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            From
          </label>
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            onBlur={applyDateRange}
            max={localTo || undefined}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
          />
        </div>

        {/* To date */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            To
          </label>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            onBlur={applyDateRange}
            min={localFrom || undefined}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Active range display */}
      {hasActiveRange && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
          {dateFrom && dateTo && dateFrom === dateTo ? (
            <span>On {new Date(dateFrom).toLocaleDateString()}</span>
          ) : (
            <span>
              {dateFrom && `From ${new Date(dateFrom).toLocaleDateString()}`}
              {dateFrom && dateTo && ' '}
              {dateTo && `to ${new Date(dateTo).toLocaleDateString()}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}