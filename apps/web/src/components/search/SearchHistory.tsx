'use client';

import { Clock, X, Trash2 } from 'lucide-react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { VideoSearchQuery } from '@/types/search';

interface SearchHistoryProps {
  onSelectSearch: (query: string, filters: VideoSearchQuery) => void;
  className?: string;
}

export function SearchHistory({ onSelectSearch, className = '' }: SearchHistoryProps) {
  const { history, isLoaded, removeSearch, clearHistory } = useSearchHistory();

  if (!isLoaded) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No recent searches</p>
        <p className="text-sm text-gray-400 mt-1">
          Your search history will appear here
        </p>
      </div>
    );
  }

  /**
   * Format timestamp as relative time
   */
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  /**
   * Format filters for display
   */
  const formatFilters = (filters: VideoSearchQuery): string => {
    const parts: string[] = [];

    if (filters.categoryIds?.length) {
      parts.push(`${filters.categoryIds.length} categories`);
    }
    if (filters.years?.length) {
      parts.push(`${filters.years.length} years`);
    }
    if (filters.conferences?.length) {
      parts.push(`${filters.conferences.length} conferences`);
    }

    return parts.length > 0 ? ` • ${parts.join(', ')}` : '';
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Searches</h3>
        
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1
                     transition-colors"
            aria-label="Clear all search history"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      {/* History List */}
      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 
                     transition-colors border border-transparent hover:border-gray-200"
          >
            <button
              onClick={() => onSelectSearch(item.query, item.filters)}
              className="flex-1 text-left min-w-0"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {item.query || 'Advanced search'}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>

              <div className="text-sm text-gray-500 truncate mt-0.5">
                {item.resultCount.toLocaleString()} results
                {formatFilters(item.filters)}
              </div>
            </button>

            <button
              onClick={() => removeSearch(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 
                       hover:text-red-600 transition-all rounded hover:bg-red-50"
              aria-label="Remove from history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}