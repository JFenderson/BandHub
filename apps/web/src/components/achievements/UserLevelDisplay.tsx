'use client';

import { Trophy, Star, TrendingUp, Award } from 'lucide-react';
import type { UserPoints } from '@/lib/api/achievements';

interface UserLevelDisplayProps {
  userPoints: UserPoints;
  showRank?: boolean;
  rank?: number | null;
  compact?: boolean;
}

// Level colors for visual distinction
const LEVEL_COLORS: Record<number, string> = {
  1: 'from-gray-400 to-gray-500',
  2: 'from-green-400 to-green-600',
  3: 'from-blue-400 to-blue-600',
  4: 'from-purple-400 to-purple-600',
  5: 'from-pink-400 to-pink-600',
  6: 'from-red-400 to-red-600',
  7: 'from-orange-400 to-orange-600',
  8: 'from-yellow-400 to-amber-600',
  9: 'from-cyan-400 to-teal-600',
  10: 'from-amber-400 via-yellow-500 to-orange-500',
};

export function UserLevelDisplay({
  userPoints,
  showRank = false,
  rank,
  compact = false,
}: UserLevelDisplayProps) {
  const levelGradient = LEVEL_COLORS[userPoints.currentLevel] || LEVEL_COLORS[1];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Level badge */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center
          bg-gradient-to-br ${levelGradient} text-white font-bold text-lg
          shadow-lg
        `}>
          {userPoints.currentLevel}
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {userPoints.levelTitle}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {userPoints.totalPoints.toLocaleString()} pts
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Large level badge */}
          <div className={`
            w-20 h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br ${levelGradient} text-white font-bold text-3xl
            shadow-xl ring-4 ring-white dark:ring-gray-800
          `}>
            {userPoints.currentLevel}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {userPoints.levelTitle}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Level {userPoints.currentLevel}
            </p>
          </div>
        </div>

        {/* Rank display */}
        {showRank && rank && (
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Global Rank</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              #{rank.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
          <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userPoints.totalPoints.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Points</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
          <Award className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userPoints.achievementsUnlocked}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Achievements</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
          <Star className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userPoints.currentLevel}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Level</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userPoints.progressToNextLevel}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">To Next Level</div>
        </div>
      </div>

      {/* Progress to next level */}
      {userPoints.currentLevel < 10 && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progress to Level {userPoints.currentLevel + 1}</span>
            <span>{userPoints.totalPoints} / {userPoints.nextLevelPoints} pts</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${levelGradient} transition-all duration-500`}
              style={{ width: `${userPoints.progressToNextLevel}%` }}
            />
          </div>
        </div>
      )}

      {/* Max level reached */}
      {userPoints.currentLevel === 10 && (
        <div className="text-center py-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
          <Star className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            Maximum Level Reached!
          </p>
        </div>
      )}
    </div>
  );
}

// Skeleton loader
export function UserLevelDisplaySkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div>
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div>
          <div className="w-32 h-7 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2" />
            <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-1" />
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
  );
}
