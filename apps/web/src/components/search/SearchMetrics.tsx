'use client';

import { Clock, Hash } from 'lucide-react';

interface SearchMetricsProps {
  total: number;
  searchTime: number;
  currentPage?: number;
  totalPages?: number;
  className?: string;
}

export function SearchMetrics({
  total,
  searchTime,
  currentPage = 1,
  totalPages = 1,
  className = '',
}: SearchMetricsProps) {
  /**
   * Format search time for display
   */
  const formatSearchTime = (ms: number): string => {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  /**
   * Format result count with proper pluralization
   */
  const formatResultCount = (count: number): string => {
    if (count === 0) return 'No results';
    if (count === 1) return '1 result';
    return `${count.toLocaleString()} results`;
  };

  return (
    <div className={`flex items-center gap-6 text-sm text-gray-600 ${className}`}>
      {/* Result count */}
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4" aria-hidden="true" />
        <span>
          {formatResultCount(total)}
          {totalPages > 1 && (
            <span className="text-gray-400 ml-1">
              (Page {currentPage} of {totalPages})
            </span>
          )}
        </span>
      </div>

      {/* Search time */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span>{formatSearchTime(searchTime)}</span>
      </div>

      {/* Performance indicator */}
      {searchTime > 0 && (
        <div className="ml-auto">
          {searchTime < 100 && (
            <span className="text-green-600 text-xs font-medium">
              ⚡ Fast
            </span>
          )}
          {searchTime >= 100 && searchTime < 500 && (
            <span className="text-yellow-600 text-xs font-medium">
              ⏱️ Normal
            </span>
          )}
          {searchTime >= 500 && (
            <span className="text-orange-600 text-xs font-medium">
              🐌 Slow
            </span>
          )}
        </div>
      )}
    </div>
  );
}