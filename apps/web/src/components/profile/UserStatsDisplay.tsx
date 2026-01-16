'use client';

import { Users, UserPlus, Heart, Clock, List } from 'lucide-react';

interface UserStats {
  followers: number;
  following: number;
  favorites: number;
  watchLater: number;
  playlists: number;
}

interface UserStatsDisplayProps {
  stats: UserStats;
  onStatClick?: (stat: keyof UserStats) => void;
  isLoading?: boolean;
}

export function UserStatsDisplay({ stats, onStatClick, isLoading = false }: UserStatsDisplayProps) {
  const statsConfig = [
    {
      key: 'followers' as const,
      label: 'Followers',
      icon: Users,
      value: stats.followers,
    },
    {
      key: 'following' as const,
      label: 'Following',
      icon: UserPlus,
      value: stats.following,
    },
    {
      key: 'favorites' as const,
      label: 'Favorites',
      icon: Heart,
      value: stats.favorites,
    },
    {
      key: 'watchLater' as const,
      label: 'Watch Later',
      icon: Clock,
      value: stats.watchLater,
    },
    {
      key: 'playlists' as const,
      label: 'Playlists',
      icon: List,
      value: stats.playlists,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse"
            role="status"
            aria-label="Loading stats"
          >
            <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-300 dark:bg-gray-600 rounded mb-1" />
            <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4" role="list">
      {statsConfig.map((stat) => {
        const Icon = stat.icon;
        const isClickable = !!onStatClick;

        return (
          <button
            key={stat.key}
            onClick={() => onStatClick?.(stat.key)}
            disabled={!isClickable}
            className={`
              bg-white dark:bg-gray-800 rounded-lg p-4 
              border border-gray-200 dark:border-gray-700 
              transition-all
              ${
                isClickable
                  ? 'hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer'
                  : 'cursor-default'
              }
            `}
            role="listitem"
            aria-label={`${stat.label}: ${stat.value.toLocaleString()}`}
            type="button"
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Icon 
                className="w-6 h-6 text-blue-600 dark:text-blue-400" 
                aria-hidden="true"
              />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
