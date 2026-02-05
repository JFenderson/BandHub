/**
 * Achievements API Client
 * Handles all achievement-related API calls
 */

export type AchievementCategory = 'WATCHING' | 'COLLECTING' | 'COMMUNITY' | 'SPECIAL';
export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  criteriaType: string;
  criteriaValue: number;
  progress?: number;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export interface UserAchievement {
  id: string;
  achievement: Achievement;
  progress: number;
  unlockedAt?: string;
  createdAt: string;
}

export interface UserPoints {
  totalPoints: number;
  currentLevel: number;
  levelTitle: string;
  achievementsUnlocked: number;
  nextLevelPoints: number;
  progressToNextLevel: number;
}

export interface UserBadges {
  recentAchievements: Achievement[];
  featuredAchievements: Achievement[];
  totalUnlocked: number;
  totalPoints: number;
  currentLevel: number;
  levelTitle: string;
}

export interface UserPerks {
  level: number;
  levelTitle: string;
  unlockedPerks: string[];
  nextPerks: { level: number; perk: string }[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  totalPoints: number;
  currentLevel: number;
  levelTitle: string;
  achievementsUnlocked: number;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  currentUserRank?: number;
}

export interface GetAchievementsParams {
  page?: number;
  limit?: number;
  category?: AchievementCategory;
  rarity?: AchievementRarity;
  unlockedOnly?: boolean;
}

export interface GetLeaderboardParams {
  page?: number;
  limit?: number;
  period?: 'all' | 'month' | 'week';
}

export interface PaginatedAchievements {
  data: Achievement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AchievementStats {
  totalAchievements: number;
  byCategory: Record<string, number>;
  byRarity: Record<string, number>;
}

/**
 * Achievements API Client
 * Some endpoints require authentication, some are public
 */
export class AchievementsApiClient {
  private baseUrl: string;
  private tokenProvider: () => string | null;

  constructor(baseUrl: string, tokenProvider: () => string | null) {
    this.baseUrl = baseUrl;
    this.tokenProvider = tokenProvider;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit & { requiresAuth?: boolean }
  ): Promise<T> {
    const requiresAuth = options?.requiresAuth ?? true;
    const token = this.tokenProvider();

    if (requiresAuth && !token) {
      throw new Error('Authentication required');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============ PUBLIC ENDPOINTS ============

  /**
   * Get all achievements (public, optionally with user progress if authenticated)
   */
  async getAchievements(params?: GetAchievementsParams): Promise<PaginatedAchievements> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.rarity) queryParams.append('rarity', params.rarity);
    if (params?.unlockedOnly) queryParams.append('unlockedOnly', 'true');

    const query = queryParams.toString();
    return this.request<PaginatedAchievements>(
      `/achievements${query ? `?${query}` : ''}`,
      { requiresAuth: false }
    );
  }

  /**
   * Get a single achievement by ID or slug
   */
  async getAchievement(idOrSlug: string): Promise<Achievement> {
    return this.request<Achievement>(`/achievements/${idOrSlug}`, { requiresAuth: false });
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<AchievementStats> {
    return this.request<AchievementStats>('/achievements/stats', { requiresAuth: false });
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(params?: GetLeaderboardParams): Promise<LeaderboardResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.period) queryParams.append('period', params.period);

    const query = queryParams.toString();
    return this.request<LeaderboardResponse>(
      `/achievements/leaderboard${query ? `?${query}` : ''}`,
      { requiresAuth: false }
    );
  }

  /**
   * Get top collectors (users with most rare achievements)
   */
  async getTopCollectors(limit: number = 10): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>(
      `/achievements/leaderboard/top-collectors?limit=${limit}`,
      { requiresAuth: false }
    );
  }

  // ============ AUTHENTICATED ENDPOINTS ============

  /**
   * Get current user's achievements
   */
  async getMyAchievements(params?: GetAchievementsParams): Promise<PaginatedAchievements> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.rarity) queryParams.append('rarity', params.rarity);
    if (params?.unlockedOnly) queryParams.append('unlockedOnly', 'true');

    const query = queryParams.toString();
    return this.request<PaginatedAchievements>(
      `/achievements/me/achievements${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get current user's points and level
   */
  async getMyPoints(): Promise<UserPoints> {
    return this.request<UserPoints>('/achievements/me/points');
  }

  /**
   * Get current user's badges for profile display
   */
  async getMyBadges(): Promise<UserBadges> {
    return this.request<UserBadges>('/achievements/me/badges');
  }

  /**
   * Get current user's perks
   */
  async getMyPerks(): Promise<UserPerks> {
    return this.request<UserPerks>('/achievements/me/perks');
  }

  /**
   * Get current user's rank on the leaderboard
   */
  async getMyRank(): Promise<{ rank: number }> {
    return this.request<{ rank: number }>('/achievements/me/rank');
  }

  /**
   * Recalculate current user's achievements
   */
  async recalculateAchievements(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/achievements/me/recalculate', {
      method: 'POST',
    });
  }

  // ============ USER PROFILE ENDPOINTS ============

  /**
   * Get another user's badges
   */
  async getUserBadges(userId: string): Promise<UserBadges> {
    return this.request<UserBadges>(`/achievements/user/${userId}/badges`, { requiresAuth: false });
  }

  /**
   * Get another user's points
   */
  async getUserPoints(userId: string): Promise<UserPoints> {
    return this.request<UserPoints>(`/achievements/user/${userId}/points`, { requiresAuth: false });
  }
}

// Export factory function with token provider
export function getAchievementsApiClient(tokenProvider: () => string | null): AchievementsApiClient {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return new AchievementsApiClient(apiUrl, tokenProvider);
}

// Utility functions for display
export const RARITY_COLORS: Record<AchievementRarity, string> = {
  COMMON: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
  UNCOMMON: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  RARE: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  EPIC: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
  LEGENDARY: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
};

export const RARITY_BORDER_COLORS: Record<AchievementRarity, string> = {
  COMMON: 'border-gray-300 dark:border-gray-600',
  UNCOMMON: 'border-green-400 dark:border-green-600',
  RARE: 'border-blue-400 dark:border-blue-600',
  EPIC: 'border-purple-400 dark:border-purple-600',
  LEGENDARY: 'border-amber-400 dark:border-amber-500',
};

export const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  WATCHING: 'play-circle',
  COLLECTING: 'heart',
  COMMUNITY: 'users',
  SPECIAL: 'star',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  WATCHING: 'Watching',
  COLLECTING: 'Collecting',
  COMMUNITY: 'Community',
  SPECIAL: 'Special',
};

export const RARITY_LABELS: Record<AchievementRarity, string> = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};
