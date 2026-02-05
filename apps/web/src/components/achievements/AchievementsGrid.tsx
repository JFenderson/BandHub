'use client';

import { useState } from 'react';
import { Filter, Trophy, ChevronDown } from 'lucide-react';
import { AchievementCard, AchievementCardSkeleton } from './AchievementCard';
import type {
  Achievement,
  AchievementCategory,
  AchievementRarity,
} from '@/lib/api/achievements';
import { CATEGORY_LABELS, RARITY_LABELS } from '@/lib/api/achievements';

interface AchievementsGridProps {
  achievements: Achievement[];
  isLoading?: boolean;
  showFilters?: boolean;
  onFilterChange?: (filters: { category?: AchievementCategory; rarity?: AchievementRarity }) => void;
  onAchievementClick?: (achievement: Achievement) => void;
  emptyMessage?: string;
}

export function AchievementsGrid({
  achievements,
  isLoading = false,
  showFilters = true,
  onFilterChange,
  onAchievementClick,
  emptyMessage = 'No achievements found',
}: AchievementsGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | ''>('');
  const [selectedRarity, setSelectedRarity] = useState<AchievementRarity | ''>('');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const handleCategoryChange = (category: AchievementCategory | '') => {
    setSelectedCategory(category);
    onFilterChange?.({
      category: category || undefined,
      rarity: selectedRarity || undefined,
    });
  };

  const handleRarityChange = (rarity: AchievementRarity | '') => {
    setSelectedRarity(rarity);
    onFilterChange?.({
      category: selectedCategory || undefined,
      rarity: rarity || undefined,
    });
  };

  // Client-side filtering for unlocked only (in addition to API filter)
  const filteredAchievements = showUnlockedOnly
    ? achievements.filter((a) => a.isUnlocked)
    : achievements;

  // Calculate stats
  const totalUnlocked = achievements.filter((a) => a.isUnlocked).length;
  const totalPoints = achievements
    .filter((a) => a.isUnlocked)
    .reduce((sum, a) => sum + a.points, 0);

  if (isLoading) {
    return (
      <div>
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <AchievementCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and stats */}
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Category filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value as AchievementCategory | '')}
                className="
                  appearance-none bg-white dark:bg-gray-800
                  border border-gray-300 dark:border-gray-600
                  rounded-lg px-4 py-2 pr-10
                  text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                "
              >
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Rarity filter */}
            <div className="relative">
              <select
                value={selectedRarity}
                onChange={(e) => handleRarityChange(e.target.value as AchievementRarity | '')}
                className="
                  appearance-none bg-white dark:bg-gray-800
                  border border-gray-300 dark:border-gray-600
                  rounded-lg px-4 py-2 pr-10
                  text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                "
              >
                <option value="">All Rarities</option>
                {Object.entries(RARITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Unlocked only toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnlockedOnly}
                onChange={(e) => setShowUnlockedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Unlocked only
              </span>
            </label>
          </div>

          {/* Stats summary */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>{totalUnlocked} / {achievements.length} unlocked</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {totalPoints.toLocaleString()} pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Achievements grid */}
      {filteredAchievements.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              onClick={onAchievementClick ? () => onAchievementClick(achievement) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

// Compact badge display for profile
interface AchievementBadgesProps {
  achievements: Achievement[];
  maxDisplay?: number;
  onViewAll?: () => void;
}

export function AchievementBadges({
  achievements,
  maxDisplay = 5,
  onViewAll,
}: AchievementBadgesProps) {
  const displayAchievements = achievements.slice(0, maxDisplay);
  const remaining = achievements.length - maxDisplay;

  return (
    <div className="flex items-center gap-2">
      {displayAchievements.map((achievement) => (
        <div
          key={achievement.id}
          className="relative group"
          title={achievement.name}
        >
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center
            bg-gradient-to-br from-amber-400 to-orange-500
            text-white text-lg
            ring-2 ring-white dark:ring-gray-800
            shadow-md
          `}>
            {achievement.name.charAt(0)}
          </div>
          {/* Tooltip */}
          <div className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            bg-gray-900 text-white text-xs px-2 py-1 rounded
            opacity-0 group-hover:opacity-100 transition-opacity
            whitespace-nowrap pointer-events-none z-10
          ">
            {achievement.name}
          </div>
        </div>
      ))}

      {remaining > 0 && (
        <button
          onClick={onViewAll}
          className="
            w-10 h-10 rounded-full flex items-center justify-center
            bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400
            text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600
            transition-colors
          "
        >
          +{remaining}
        </button>
      )}
    </div>
  );
}
