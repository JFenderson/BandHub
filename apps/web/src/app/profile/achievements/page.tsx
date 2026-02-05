'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Award, Star, TrendingUp, RefreshCw } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAchievements } from '@/hooks/useAchievements';
import { AchievementsGrid, UserLevelDisplay, UserLevelDisplaySkeleton } from '@/components/achievements';
import type { AchievementCategory, AchievementRarity } from '@/lib/api/achievements';

export default function AchievementsPage() {
  return (
    <ProtectedRoute>
      <AchievementsContent />
    </ProtectedRoute>
  );
}

function AchievementsContent() {
  const {
    achievements,
    userPoints,
    userPerks,
    userRank,
    isLoading,
    isLoadingPoints,
    error,
    fetchAchievements,
    fetchAllUserData,
    recalculateAchievements,
  } = useAchievements(false); // Disable auto-fetch, we'll fetch manually

  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch achievements and user data on mount
  useEffect(() => {
    if (!hasFetched) {
      fetchAchievements({ limit: 100 });
      fetchAllUserData();
      setHasFetched(true);
    }
  }, [hasFetched, fetchAchievements, fetchAllUserData]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateAchievements();
      await fetchAchievements({ limit: 100 });
    } catch (err) {
      console.error('Failed to recalculate achievements:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleFilterChange = useCallback(
    (filters: { category?: AchievementCategory; rarity?: AchievementRarity }) => {
      fetchAchievements({ ...filters, limit: 100 });
    },
    [fetchAchievements]
  );

  // Filter achievements based on active tab
  const filteredAchievements = achievements.filter((a) => {
    if (activeTab === 'unlocked') return a.isUnlocked;
    if (activeTab === 'locked') return !a.isUnlocked;
    return true;
  });

  // Calculate stats
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const lockedCount = achievements.filter((a) => !a.isUnlocked).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profile
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" />
              My Achievements
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your progress and unlock rewards
            </p>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="
              mt-4 md:mt-0 inline-flex items-center gap-2 px-4 py-2
              bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
              rounded-lg text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-700
              disabled:opacity-50 transition-colors
            "
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>

        {/* User Level Display */}
        <div className="mb-8">
          {isLoadingPoints || !userPoints ? (
            <UserLevelDisplaySkeleton />
          ) : (
            <UserLevelDisplay
              userPoints={userPoints}
              showRank={true}
              rank={userRank}
            />
          )}
        </div>

        {/* Perks Section */}
        {userPerks && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Your Perks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Unlocked Perks */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                  Unlocked Perks
                </h3>
                <ul className="space-y-2">
                  {userPerks.unlockedPerks.map((perk, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-gray-900 dark:text-white"
                    >
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Next Perks */}
              {userPerks.nextPerks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Coming Up
                  </h3>
                  <ul className="space-y-2">
                    {userPerks.nextPerks.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-gray-500 dark:text-gray-400"
                      >
                        <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold">
                          {item.level}
                        </div>
                        {item.perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('all')}
                className={`
                  flex-1 px-6 py-4 text-sm font-medium text-center border-b-2
                  ${activeTab === 'all'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                All ({achievements.length})
              </button>
              <button
                onClick={() => setActiveTab('unlocked')}
                className={`
                  flex-1 px-6 py-4 text-sm font-medium text-center border-b-2
                  ${activeTab === 'unlocked'
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                Unlocked ({unlockedCount})
              </button>
              <button
                onClick={() => setActiveTab('locked')}
                className={`
                  flex-1 px-6 py-4 text-sm font-medium text-center border-b-2
                  ${activeTab === 'locked'
                    ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                Locked ({lockedCount})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <AchievementsGrid
              achievements={filteredAchievements}
              isLoading={isLoading}
              showFilters={true}
              onFilterChange={handleFilterChange}
              emptyMessage={
                activeTab === 'unlocked'
                  ? "You haven't unlocked any achievements yet. Start exploring!"
                  : activeTab === 'locked'
                  ? 'Great job! No more achievements to unlock.'
                  : 'No achievements found.'
              }
            />
          </div>
        </div>

        {/* Leaderboard Link */}
        <div className="mt-8 text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:underline"
          >
            <TrendingUp className="w-5 h-5" />
            View Global Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
