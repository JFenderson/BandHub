import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import {
  GetLeaderboardQueryDto,
  LeaderboardResponseDto,
  LeaderboardEntryDto,
} from './dto/achievement.dto';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the leaderboard
   */
  async getLeaderboard(
    query: GetLeaderboardQueryDto,
    currentUserId?: string
  ): Promise<LeaderboardResponseDto> {
    const { page = 1, limit = 20, period = 'all' } = query;
    const skip = (page - 1) * limit;

    // Build date filter for period
    let dateFilter: Date | undefined;
    if (period === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === 'month') {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    }

    // For period-based leaderboards, we need to calculate points from achievements
    // unlocked within the period
    if (dateFilter) {
      return this.getPeriodLeaderboard(query, dateFilter, currentUserId);
    }

    // All-time leaderboard uses UserPoints table
    const [users, total] = await Promise.all([
      this.prisma.userPoints.findMany({
        skip,
        take: limit,
        orderBy: { totalPoints: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.userPoints.count(),
    ]);

    // Get achievement counts
    const achievementCounts = await this.prisma.userAchievement.groupBy({
      by: ['userId'],
      where: {
        userId: { in: users.map(u => u.userId) },
        unlockedAt: { not: null },
      },
      _count: true,
    });

    const countMap = new Map(
      achievementCounts.map(ac => [ac.userId, ac._count])
    );

    const data: LeaderboardEntryDto[] = users.map((u, index) => ({
      rank: skip + index + 1,
      userId: u.userId,
      username: u.user.username || u.user.name,
      avatar: u.user.avatar || undefined,
      totalPoints: u.totalPoints,
      currentLevel: u.currentLevel,
      levelTitle: u.levelTitle,
      achievementsUnlocked: countMap.get(u.userId) || 0,
    }));

    // Get current user's rank if logged in
    let currentUserRank: number | undefined;
    if (currentUserId) {
      currentUserRank = await this.getUserRank(currentUserId);
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      currentUserRank,
    };
  }

  /**
   * Get period-based leaderboard (week/month)
   */
  private async getPeriodLeaderboard(
    query: GetLeaderboardQueryDto,
    dateFilter: Date,
    currentUserId?: string
  ): Promise<LeaderboardResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Get points earned in the period
    const periodPoints = await this.prisma.userAchievement.groupBy({
      by: ['userId'],
      where: {
        unlockedAt: { gte: dateFilter },
      },
      _sum: {
        progress: true, // Note: We're using a subquery approach
      },
    });

    // We need to join with achievements to get points
    const achievementsInPeriod = await this.prisma.userAchievement.findMany({
      where: {
        unlockedAt: { gte: dateFilter },
      },
      include: {
        achievement: {
          select: { points: true },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Aggregate points by user
    const userPointsMap = new Map<string, {
      points: number;
      achievementsUnlocked: number;
      user: { id: string; username: string | null; name: string; avatar: string | null };
    }>();

    for (const ua of achievementsInPeriod) {
      const existing = userPointsMap.get(ua.userId);
      if (existing) {
        existing.points += ua.achievement.points;
        existing.achievementsUnlocked++;
      } else {
        userPointsMap.set(ua.userId, {
          points: ua.achievement.points,
          achievementsUnlocked: 1,
          user: ua.user,
        });
      }
    }

    // Sort by points
    const sortedUsers = Array.from(userPointsMap.entries())
      .sort((a, b) => b[1].points - a[1].points);

    const total = sortedUsers.length;
    const paginatedUsers = sortedUsers.slice(skip, skip + limit);

    // Get user levels from UserPoints
    const userIds = paginatedUsers.map(([userId]) => userId);
    const userLevels = await this.prisma.userPoints.findMany({
      where: { userId: { in: userIds } },
    });
    const levelMap = new Map(userLevels.map(ul => [ul.userId, ul]));

    const data: LeaderboardEntryDto[] = paginatedUsers.map(([userId, data], index) => {
      const level = levelMap.get(userId);
      return {
        rank: skip + index + 1,
        userId,
        username: data.user.username || data.user.name,
        avatar: data.user.avatar || undefined,
        totalPoints: data.points,
        currentLevel: level?.currentLevel || 1,
        levelTitle: level?.levelTitle || 'Rookie',
        achievementsUnlocked: data.achievementsUnlocked,
      };
    });

    // Get current user's rank in this period
    let currentUserRank: number | undefined;
    if (currentUserId) {
      const userIndex = sortedUsers.findIndex(([userId]) => userId === currentUserId);
      currentUserRank = userIndex >= 0 ? userIndex + 1 : undefined;
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      currentUserRank,
    };
  }

  /**
   * Get a user's rank on the all-time leaderboard
   */
  async getUserRank(userId: string): Promise<number | undefined> {
    const userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) return undefined;

    const higherRanked = await this.prisma.userPoints.count({
      where: {
        totalPoints: { gt: userPoints.totalPoints },
      },
    });

    return higherRanked + 1;
  }

  /**
   * Get top collectors (users with most rare achievements)
   */
  async getTopCollectors(limit: number = 10) {
    const topCollectors = await this.prisma.userAchievement.groupBy({
      by: ['userId'],
      where: {
        unlockedAt: { not: null },
        achievement: {
          rarity: { in: ['RARE', 'EPIC', 'LEGENDARY'] },
        },
      },
      _count: true,
      orderBy: {
        _count: {
          achievementId: 'desc',
        },
      },
      take: limit,
    });

    const userIds = topCollectors.map(tc => tc.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));
    const userPoints = await this.prisma.userPoints.findMany({
      where: { userId: { in: userIds } },
    });
    const pointsMap = new Map(userPoints.map(up => [up.userId, up]));

    return topCollectors.map((tc, index) => {
      const user = userMap.get(tc.userId);
      const points = pointsMap.get(tc.userId);
      return {
        rank: index + 1,
        userId: tc.userId,
        username: user?.username || user?.name || 'Unknown',
        avatar: user?.avatar || undefined,
        rareAchievements: tc._count,
        totalPoints: points?.totalPoints || 0,
        currentLevel: points?.currentLevel || 1,
        levelTitle: points?.levelTitle || 'Rookie',
      };
    });
  }

  /**
   * Get leaderboard for a specific achievement category
   */
  async getCategoryLeaderboard(
    category: string,
    limit: number = 10
  ) {
    const achievements = await this.prisma.userAchievement.findMany({
      where: {
        unlockedAt: { not: null },
        achievement: { category: category as any },
      },
      include: {
        achievement: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Aggregate by user
    const userStats = new Map<string, {
      points: number;
      count: number;
      user: { id: string; username: string | null; name: string; avatar: string | null };
    }>();

    for (const ua of achievements) {
      const existing = userStats.get(ua.userId);
      if (existing) {
        existing.points += ua.achievement.points;
        existing.count++;
      } else {
        userStats.set(ua.userId, {
          points: ua.achievement.points,
          count: 1,
          user: ua.user,
        });
      }
    }

    const sorted = Array.from(userStats.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, limit);

    return sorted.map(([userId, data], index) => ({
      rank: index + 1,
      userId,
      username: data.user.username || data.user.name,
      avatar: data.user.avatar || undefined,
      categoryPoints: data.points,
      categoryAchievements: data.count,
    }));
  }
}
