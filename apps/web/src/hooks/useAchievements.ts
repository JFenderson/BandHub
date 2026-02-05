'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAchievementsApiClient,
  type Achievement,
  type UserPoints,
  type UserBadges,
  type UserPerks,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type GetAchievementsParams,
  type GetLeaderboardParams,
  type AchievementCategory,
  type AchievementRarity,
} from '@/lib/api/achievements';
import { useUser } from '@/contexts/UserContext';
import { getAuthTokens } from '@/lib/utils/cookies';

/**
 * Custom hook for managing user achievements
 */
export function useAchievements(autoFetch = true) {
  const { user } = useUser();

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // User stats state
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadges | null>(null);
  const [userPerks, setUserPerks] = useState<UserPerks | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(
    () => getAchievementsApiClient(() => getAuthTokens().accessToken),
    []
  );

  /**
   * Fetch all achievements (with optional user progress)
   */
  const fetchAchievements = useCallback(async (params?: GetAchievementsParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getAchievements(params);
      setAchievements(response.data);
      setTotalAchievements(response.meta.total);
      setTotalPages(response.meta.totalPages);
      setCurrentPage(response.meta.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch achievements');
      console.error('Error fetching achievements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  /**
   * Fetch current user's achievements
   */
  const fetchMyAchievements = useCallback(async (params?: GetAchievementsParams) => {
    if (!user) {
      setAchievements([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getMyAchievements(params);
      setAchievements(response.data);
      setTotalAchievements(response.meta.total);
      setTotalPages(response.meta.totalPages);
      setCurrentPage(response.meta.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch achievements');
      console.error('Error fetching my achievements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, apiClient]);

  /**
   * Fetch user's points and level
   */
  const fetchUserPoints = useCallback(async () => {
    if (!user) {
      setUserPoints(null);
      return;
    }

    setIsLoadingPoints(true);
    setError(null);

    try {
      const points = await apiClient.getMyPoints();
      setUserPoints(points);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user points');
      console.error('Error fetching user points:', err);
    } finally {
      setIsLoadingPoints(false);
    }
  }, [user, apiClient]);

  /**
   * Fetch user's badges for profile display
   */
  const fetchUserBadges = useCallback(async () => {
    if (!user) {
      setUserBadges(null);
      return;
    }

    setIsLoadingBadges(true);
    setError(null);

    try {
      const badges = await apiClient.getMyBadges();
      setUserBadges(badges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user badges');
      console.error('Error fetching user badges:', err);
    } finally {
      setIsLoadingBadges(false);
    }
  }, [user, apiClient]);

  /**
   * Fetch user's perks
   */
  const fetchUserPerks = useCallback(async () => {
    if (!user) {
      setUserPerks(null);
      return;
    }

    try {
      const perks = await apiClient.getMyPerks();
      setUserPerks(perks);
    } catch (err) {
      console.error('Error fetching user perks:', err);
    }
  }, [user, apiClient]);

  /**
   * Fetch user's leaderboard rank
   */
  const fetchUserRank = useCallback(async () => {
    if (!user) {
      setUserRank(null);
      return;
    }

    try {
      const { rank } = await apiClient.getMyRank();
      setUserRank(rank);
    } catch (err) {
      console.error('Error fetching user rank:', err);
    }
  }, [user, apiClient]);

  /**
   * Fetch all user achievement data at once
   */
  const fetchAllUserData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchUserPoints(),
        fetchUserBadges(),
        fetchUserPerks(),
        fetchUserRank(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch achievement data');
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchUserPoints, fetchUserBadges, fetchUserPerks, fetchUserRank]);

  /**
   * Get a single achievement
   */
  const getAchievement = useCallback(async (idOrSlug: string): Promise<Achievement> => {
    try {
      return await apiClient.getAchievement(idOrSlug);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch achievement';
      setError(errorMessage);
      throw err;
    }
  }, [apiClient]);

  /**
   * Recalculate achievements (useful for retroactive awards)
   */
  const recalculateAchievements = useCallback(async (): Promise<void> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      await apiClient.recalculateAchievements();
      // Refresh all data after recalculation
      await fetchAllUserData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to recalculate achievements';
      setError(errorMessage);
      throw err;
    }
  }, [user, apiClient, fetchAllUserData]);

  // Auto-fetch user data on mount if enabled and user is authenticated
  useEffect(() => {
    if (autoFetch && user) {
      fetchAllUserData();
    }
  }, [autoFetch, user, fetchAllUserData]);

  return {
    // Achievements
    achievements,
    totalAchievements,
    totalPages,
    currentPage,

    // User stats
    userPoints,
    userBadges,
    userPerks,
    userRank,

    // Loading states
    isLoading,
    isLoadingPoints,
    isLoadingBadges,
    error,

    // Methods
    fetchAchievements,
    fetchMyAchievements,
    fetchUserPoints,
    fetchUserBadges,
    fetchUserPerks,
    fetchUserRank,
    fetchAllUserData,
    getAchievement,
    recalculateAchievements,
  };
}

/**
 * Hook for leaderboard data
 */
export function useLeaderboard(autoFetch = true) {
  const { user } = useUser();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [topCollectors, setTopCollectors] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(
    () => getAchievementsApiClient(() => getAuthTokens().accessToken),
    []
  );

  /**
   * Fetch leaderboard
   */
  const fetchLeaderboard = useCallback(async (params?: GetLeaderboardParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getLeaderboard(params);
      setLeaderboard(response.data);
      setCurrentUserRank(response.currentUserRank);
      setTotalPages(response.meta.totalPages);
      setCurrentPage(response.meta.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  /**
   * Fetch top collectors
   */
  const fetchTopCollectors = useCallback(async (limit: number = 10) => {
    try {
      const collectors = await apiClient.getTopCollectors(limit);
      setTopCollectors(collectors);
    } catch (err) {
      console.error('Error fetching top collectors:', err);
    }
  }, [apiClient]);

  // Auto-fetch leaderboard on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchLeaderboard();
    }
  }, [autoFetch, fetchLeaderboard]);

  return {
    leaderboard,
    topCollectors,
    currentUserRank,
    totalPages,
    currentPage,
    isLoading,
    error,
    fetchLeaderboard,
    fetchTopCollectors,
  };
}

// Re-export types for convenience
export type {
  Achievement,
  UserPoints,
  UserBadges,
  UserPerks,
  LeaderboardEntry,
  LeaderboardResponse,
  GetAchievementsParams,
  GetLeaderboardParams,
  AchievementCategory,
  AchievementRarity,
};
