import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { NotificationsService } from '../notifications/notifications.service';
import {
  getLevelFromPoints,
  EARLY_ADOPTER_CUTOFF,
  FOUNDING_MEMBER_LIMIT,
} from './achievement-definitions';

export interface AchievementUnlockResult {
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  points: number;
  rarity: string;
  isNewLevel: boolean;
  newLevel?: number;
  newLevelTitle?: string;
}

@Injectable()
export class AchievementTrackerService {
  private readonly logger = new Logger(AchievementTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Track video watched event
   */
  async trackVideoWatched(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.watchHistory.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'videos_watched', count);
  }

  /**
   * Track band favorited event
   */
  async trackBandFavorited(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.favoriteBand.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'bands_favorited', count);
  }

  /**
   * Track video favorited event
   */
  async trackVideoFavorited(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.favoriteVideo.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'videos_favorited', count);
  }

  /**
   * Track comment posted event
   */
  async trackCommentPosted(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.comment.count({
      where: { userId, isDeleted: false },
    });

    return this.checkAndUnlockAchievements(userId, 'comments_posted', count);
  }

  /**
   * Track review posted event
   */
  async trackReviewPosted(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.review.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'reviews_posted', count);
  }

  /**
   * Track playlist created event
   */
  async trackPlaylistCreated(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.playlist.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'playlists_created', count);
  }

  /**
   * Track user followed event
   */
  async trackUserFollowed(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.userFollower.count({
      where: { followerId: userId },
    });

    return this.checkAndUnlockAchievements(userId, 'users_following', count);
  }

  /**
   * Track content shared event
   */
  async trackContentShared(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.contentShare.count({
      where: { userId },
    });

    return this.checkAndUnlockAchievements(userId, 'shares_count', count);
  }

  /**
   * Track watch streak
   */
  async trackWatchStreak(userId: string): Promise<AchievementUnlockResult[]> {
    // Get watch history for streak calculation
    const watchHistory = await this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      select: { watchedAt: true },
    });

    if (watchHistory.length === 0) return [];

    // Calculate streak
    let streak = 1;
    let currentDate = new Date(watchHistory[0].watchedAt);
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 1; i < watchHistory.length; i++) {
      const watchDate = new Date(watchHistory[i].watchedAt);
      watchDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - watchDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        streak++;
        currentDate = watchDate;
      } else if (diffDays > 1) {
        break;
      }
    }

    return this.checkAndUnlockAchievements(userId, 'watch_streak_days', streak);
  }

  /**
   * Check and unlock achievements for new users
   */
  async trackNewUser(userId: string): Promise<AchievementUnlockResult[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return [];

    const results: AchievementUnlockResult[] = [];

    // Check early adopter
    if (user.createdAt <= EARLY_ADOPTER_CUTOFF) {
      const earlyAdopterResults = await this.checkAndUnlockAchievements(
        userId,
        'early_adopter',
        1
      );
      results.push(...earlyAdopterResults);
    }

    // Check founding member
    const userCount = await this.prisma.user.count({
      where: { createdAt: { lte: user.createdAt } },
    });

    if (userCount <= FOUNDING_MEMBER_LIMIT) {
      const foundingResults = await this.checkAndUnlockAchievements(
        userId,
        'founding_member',
        1
      );
      results.push(...foundingResults);
    }

    return results;
  }

  /**
   * Check account age achievements (run periodically)
   */
  async checkAccountAgeAchievements(userId: string): Promise<AchievementUnlockResult[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return [];

    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return this.checkAndUnlockAchievements(userId, 'account_age_days', accountAgeDays);
  }

  /**
   * Check achievements unlocked count (meta achievement)
   */
  async checkAchievementsUnlocked(userId: string): Promise<AchievementUnlockResult[]> {
    const count = await this.prisma.userAchievement.count({
      where: { userId, unlockedAt: { not: null } },
    });

    return this.checkAndUnlockAchievements(userId, 'achievements_unlocked', count);
  }

  /**
   * Core method to check and unlock achievements
   */
  private async checkAndUnlockAchievements(
    userId: string,
    criteriaType: string,
    currentValue: number
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = [];

    // Find matching achievements that haven't been unlocked
    const achievements = await this.prisma.achievement.findMany({
      where: {
        criteriaType,
        isActive: true,
        criteriaValue: { lte: currentValue },
      },
    });

    for (const achievement of achievements) {
      // Check if already unlocked
      const existingUserAchievement = await this.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
      });

      if (existingUserAchievement?.unlockedAt) {
        // Already unlocked, just update progress
        await this.prisma.userAchievement.update({
          where: { id: existingUserAchievement.id },
          data: { progress: currentValue },
        });
        continue;
      }

      // Unlock the achievement
      const now = new Date();
      await this.prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        update: {
          progress: currentValue,
          unlockedAt: now,
        },
        create: {
          userId,
          achievementId: achievement.id,
          progress: currentValue,
          unlockedAt: now,
        },
      });

      // Update user points
      const levelResult = await this.updateUserPoints(userId, achievement.points);

      // Create notification
      await this.notificationsService.createNotification(userId, {
        type: 'ACHIEVEMENT_UNLOCKED' as any,
        title: `Achievement Unlocked: ${achievement.name}`,
        message: achievement.description,
        data: {
          achievementId: achievement.id,
          achievementSlug: achievement.slug,
          points: achievement.points,
          rarity: achievement.rarity,
        },
      });

      results.push({
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        points: achievement.points,
        rarity: achievement.rarity,
        isNewLevel: levelResult.isNewLevel,
        newLevel: levelResult.newLevel,
        newLevelTitle: levelResult.newLevelTitle,
      });

      this.logger.log(
        `User ${userId} unlocked achievement: ${achievement.name} (+${achievement.points} points)`
      );
    }

    // Update progress for achievements not yet unlocked
    await this.updateProgress(userId, criteriaType, currentValue);

    // Check meta achievement (achievements unlocked)
    if (criteriaType !== 'achievements_unlocked' && results.length > 0) {
      const metaResults = await this.checkAchievementsUnlocked(userId);
      results.push(...metaResults);
    }

    return results;
  }

  /**
   * Update progress for achievements in progress
   */
  private async updateProgress(
    userId: string,
    criteriaType: string,
    currentValue: number
  ): Promise<void> {
    // Find achievements of this type that user hasn't unlocked
    const achievements = await this.prisma.achievement.findMany({
      where: {
        criteriaType,
        isActive: true,
        criteriaValue: { gt: currentValue },
      },
    });

    for (const achievement of achievements) {
      await this.prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        update: { progress: currentValue },
        create: {
          userId,
          achievementId: achievement.id,
          progress: currentValue,
        },
      });
    }
  }

  /**
   * Update user points and level
   */
  private async updateUserPoints(
    userId: string,
    pointsToAdd: number
  ): Promise<{ isNewLevel: boolean; newLevel?: number; newLevelTitle?: string }> {
    let userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });

    const previousLevel = userPoints?.currentLevel || 1;
    const newTotalPoints = (userPoints?.totalPoints || 0) + pointsToAdd;
    const levelInfo = getLevelFromPoints(newTotalPoints);

    if (userPoints) {
      await this.prisma.userPoints.update({
        where: { userId },
        data: {
          totalPoints: newTotalPoints,
          currentLevel: levelInfo.level,
          levelTitle: levelInfo.title,
        },
      });
    } else {
      await this.prisma.userPoints.create({
        data: {
          userId,
          totalPoints: newTotalPoints,
          currentLevel: levelInfo.level,
          levelTitle: levelInfo.title,
        },
      });
    }

    const isNewLevel = levelInfo.level > previousLevel;

    if (isNewLevel) {
      // Create level up notification
      await this.notificationsService.createNotification(userId, {
        type: 'LEVEL_UP' as any,
        title: `Level Up! You're now level ${levelInfo.level}`,
        message: `You've earned the title: ${levelInfo.title}`,
        data: {
          newLevel: levelInfo.level,
          levelTitle: levelInfo.title,
          totalPoints: newTotalPoints,
        },
      });

      this.logger.log(
        `User ${userId} leveled up to level ${levelInfo.level}: ${levelInfo.title}`
      );
    }

    return {
      isNewLevel,
      newLevel: isNewLevel ? levelInfo.level : undefined,
      newLevelTitle: isNewLevel ? levelInfo.title : undefined,
    };
  }

  /**
   * Recalculate all achievements for a user
   */
  async recalculateUserAchievements(userId: string): Promise<void> {
    this.logger.log(`Recalculating achievements for user ${userId}`);

    // Track all activity types
    await Promise.all([
      this.trackVideoWatched(userId),
      this.trackBandFavorited(userId),
      this.trackVideoFavorited(userId),
      this.trackCommentPosted(userId),
      this.trackReviewPosted(userId),
      this.trackPlaylistCreated(userId),
      this.trackUserFollowed(userId),
      this.trackContentShared(userId),
      this.trackWatchStreak(userId),
      this.checkAccountAgeAchievements(userId),
    ]);

    // Check special achievements
    await this.trackNewUser(userId);

    this.logger.log(`Finished recalculating achievements for user ${userId}`);
  }
}
