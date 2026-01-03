import { TrendingUp } from 'lucide-react';
import { getPopularSearches } from '@/lib/api/search';
import { PopularSearch } from '@/types/search';

interface PopularSearchesProps {
  onSelectSearch: (query: string) => void;
  className?: string;
}

export async function PopularSearches({ 
  onSelectSearch, 
  className = '' 
}: PopularSearchesProps) {
  let searches: PopularSearch[] = [];
  
  try {
    searches = await getPopularSearches(10);
  } catch (error) {
    console.error('Failed to fetch popular searches:', error);
    return null;
  }

  if (searches.length === 0) {
    return null;
  }

  /**
   * Get trend icon
   */
  const getTrendIcon = (trend: PopularSearch['trend']) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗</span>;
      case 'down':
        return <span className="text-red-500">↘</span>;
      default:
        return <span className="text-gray-400">→</span>;
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Popular Searches
        </h3>
      </div>

      {/* Searches grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {searches.map((search, index) => (
          <button
            key={index}
            onClick={() => onSelectSearch(search.query)}
            className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300
                     hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 group-hover:text-blue-600
                             transition-colors truncate">
                {search.query}
              </span>
              {getTrendIcon(search.trend)}
            </div>
            <span className="text-xs text-gray-500">
              {search.count.toLocaleString()} searches
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Client wrapper for interactivity
'use client';

export function PopularSearchesClient({ 
  searches,
  onSelectSearch, 
  className = '' 
}: { 
  searches: PopularSearch[];
  onSelectSearch: (query: string) => void;
  className?: string;
}) {
  if (searches.length === 0) {
    return null;
  }

  const getTrendIcon = (trend: PopularSearch['trend']) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗</span>;
      case 'down':
        return <span className="text-red-500">↘</span>;
      default:
        return <span className="text-gray-400">→</span>;
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Popular Searches
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {searches.map((search, index) => (
          <button
            key={index}
            onClick={() => onSelectSearch(search.query)}
            className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300
                     hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 group-hover:text-blue-600
                             transition-colors truncate">
                {search.query}
              </span>
              {getTrendIcon(search.trend)}
            </div>
            <span className="text-xs text-gray-500">
              {search.count.toLocaleString()} searches
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}