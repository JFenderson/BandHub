import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import {
  GetAchievementsQueryDto,
  AchievementResponseDto,
  UserPointsResponseDto,
  UserBadgesResponseDto,
  PerksResponseDto,
} from './dto/achievement.dto';
import {
  AchievementCategory,
  AchievementRarity,
  ACHIEVEMENT_DEFINITIONS,
  getLevelFromPoints,
  getPerksForLevel,
  getNextPerks,
} from './achievement-definitions';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all achievements with user progress
   */
  async getAchievements(userId: string | null, query: GetAchievementsQueryDto) {
    const { page = 1, limit = 20, category, rarity, unlockedOnly } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    if (rarity) where.rarity = rarity;

    // Get achievements
    const [achievements, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { points: 'asc' }],
      }),
      this.prisma.achievement.count({ where }),
    ]);

    // If user is logged in, get their progress
    let userAchievements: Map<string, { progress: number; unlockedAt: Date | null }> = new Map();
    if (userId) {
      const userProgress = await this.prisma.userAchievement.findMany({
        where: { userId },
      });
      userProgress.forEach(ua => {
        userAchievements.set(ua.achievementId, {
          progress: ua.progress,
          unlockedAt: ua.unlockedAt,
        });
      });
    }

    let data = achievements.map(achievement => {
      const userProgress = userAchievements.get(achievement.id);
      const isUnlocked = userProgress?.unlockedAt != null;

      // Hide secret achievements that aren't unlocked
      if (achievement.isSecret && !isUnlocked) {
        return {
          id: achievement.id,
          slug: 'secret',
          name: '???',
          description: 'This achievement is a secret!',
          icon: 'lock',
          category: achievement.category as AchievementCategory,
          rarity: achievement.rarity as AchievementRarity,
          points: achievement.points,
          criteriaType: 'secret',
          criteriaValue: 0,
          progress: 0,
          unlockedAt: null,
          isUnlocked: false,
        };
      }

      return {
        id: achievement.id,
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category as AchievementCategory,
        rarity: achievement.rarity as AchievementRarity,
        points: achievement.points,
        criteriaType: achievement.criteriaType,
        criteriaValue: achievement.criteriaValue,
        progress: userProgress?.progress || 0,
        unlockedAt: userProgress?.unlockedAt || null,
        isUnlocked,
      };
    });

    // Filter to only unlocked if requested
    if (unlockedOnly) {
      data = data.filter(a => a.isUnlocked);
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single achievement by ID or slug
   */
  async getAchievement(idOrSlug: string, userId: string | null): Promise<AchievementResponseDto> {
    const achievement = await this.prisma.achievement.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
    });

    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    let progress = 0;
    let unlockedAt: Date | null = null;

    if (userId) {
      const userAchievement = await this.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
      });
      if (userAchievement) {
        progress = userAchievement.progress;
        unlockedAt = userAchievement.unlockedAt;
      }
    }

    const isUnlocked = unlockedAt != null;

    // Hide secret achievements that aren't unlocked
    if (achievement.isSecret && !isUnlocked) {
      return {
        id: achievement.id,
        slug: 'secret',
        name: '???',
        description: 'This achievement is a secret!',
        icon: 'lock',
        category: achievement.category as AchievementCategory,
        rarity: achievement.rarity as AchievementRarity,
        points: achievement.points,
        criteriaType: 'secret',
        criteriaValue: 0,
        progress: 0,
        unlockedAt: undefined,
        isUnlocked: false,
      };
    }

    return {
      id: achievement.id,
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category as AchievementCategory,
      rarity: achievement.rarity as AchievementRarity,
      points: achievement.points,
      criteriaType: achievement.criteriaType,
      criteriaValue: achievement.criteriaValue,
      progress,
      unlockedAt: unlockedAt || undefined,
      isUnlocked,
    };
  }

  /**
   * Get user's achievements
   */
  async getUserAchievements(userId: string, query: GetAchievementsQueryDto) {
    const { page = 1, limit = 20, category, rarity, unlockedOnly } = query;
    const skip = (page - 1) * limit;

    const achievementWhere: Record<string, unknown> = { isActive: true };
    if (category) achievementWhere.category = category;
    if (rarity) achievementWhere.rarity = rarity;

    const where: Record<string, unknown> = {
      userId,
      achievement: achievementWhere,
    };

    if (unlockedOnly) {
      where.unlockedAt = { not: null };
    }

    const [userAchievements, total] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ unlockedAt: 'desc' }],
        include: {
          achievement: true,
        },
      }),
      this.prisma.userAchievement.count({ where }),
    ]);

    const data = userAchievements.map(ua => ({
      id: ua.id,
      achievement: {
        id: ua.achievement.id,
        slug: ua.achievement.slug,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        category: ua.achievement.category as AchievementCategory,
        rarity: ua.achievement.rarity as AchievementRarity,
        points: ua.achievement.points,
        criteriaType: ua.achievement.criteriaType,
        criteriaValue: ua.achievement.criteriaValue,
        progress: ua.progress,
        unlockedAt: ua.unlockedAt || undefined,
        isUnlocked: ua.unlockedAt != null,
      },
      progress: ua.progress,
      unlockedAt: ua.unlockedAt || undefined,
      createdAt: ua.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's points and level
   */
  async getUserPoints(userId: string): Promise<UserPointsResponseDto> {
    let userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      // Calculate from achievements if not exists
      const unlockedAchievements = await this.prisma.userAchievement.findMany({
        where: { userId, unlockedAt: { not: null } },
        include: { achievement: true },
      });

      const totalPoints = unlockedAchievements.reduce(
        (sum, ua) => sum + ua.achievement.points,
        0
      );
      const levelInfo = getLevelFromPoints(totalPoints);

      userPoints = await this.prisma.userPoints.create({
        data: {
          userId,
          totalPoints,
          currentLevel: levelInfo.level,
          levelTitle: levelInfo.title,
        },
      });
    }

    const achievementsUnlocked = await this.prisma.userAchievement.count({
      where: { userId, unlockedAt: { not: null } },
    });

    const levelInfo = getLevelFromPoints(userPoints.totalPoints);
    const currentLevelPoints = userPoints.totalPoints - (levelInfo.level > 1
      ? this.getLevelMinPoints(levelInfo.level)
      : 0);
    const pointsToNextLevel = levelInfo.nextLevelPoints - this.getLevelMinPoints(levelInfo.level);
    const progressToNextLevel = pointsToNextLevel > 0
      ? Math.min(100, Math.round((currentLevelPoints / pointsToNextLevel) * 100))
      : 100;

    return {
      totalPoints: userPoints.totalPoints,
      currentLevel: userPoints.currentLevel,
      levelTitle: userPoints.levelTitle,
      achievementsUnlocked,
      nextLevelPoints: levelInfo.nextLevelPoints,
      progressToNextLevel,
    };
  }

  /**
   * Get badges for user profile display
   */
  async getUserBadges(userId: string): Promise<UserBadgesResponseDto> {
    // Get recent achievements (last 5 unlocked)
    const recentAchievements = await this.prisma.userAchievement.findMany({
      where: { userId, unlockedAt: { not: null } },
      orderBy: { unlockedAt: 'desc' },
      take: 5,
      include: { achievement: true },
    });

    // Get featured achievements (highest rarity unlocked)
    const featuredAchievements = await this.prisma.userAchievement.findMany({
      where: { userId, unlockedAt: { not: null } },
      orderBy: { achievement: { rarity: 'desc' } },
      take: 3,
      include: { achievement: true },
    });

    // Get stats
    const [totalUnlocked, userPoints] = await Promise.all([
      this.prisma.userAchievement.count({
        where: { userId, unlockedAt: { not: null } },
      }),
      this.getUserPoints(userId),
    ]);

    const mapAchievement = (ua: any): AchievementResponseDto => ({
      id: ua.achievement.id,
      slug: ua.achievement.slug,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      category: ua.achievement.category as AchievementCategory,
      rarity: ua.achievement.rarity as AchievementRarity,
      points: ua.achievement.points,
      criteriaType: ua.achievement.criteriaType,
      criteriaValue: ua.achievement.criteriaValue,
      progress: ua.progress,
      unlockedAt: ua.unlockedAt,
      isUnlocked: true,
    });

    return {
      recentAchievements: recentAchievements.map(mapAchievement),
      featuredAchievements: featuredAchievements.map(mapAchievement),
      totalUnlocked,
      totalPoints: userPoints.totalPoints,
      currentLevel: userPoints.currentLevel,
      levelTitle: userPoints.levelTitle,
    };
  }

  /**
   * Get user perks based on level
   */
  async getUserPerks(userId: string): Promise<PerksResponseDto> {
    const userPoints = await this.getUserPoints(userId);

    return {
      level: userPoints.currentLevel,
      levelTitle: userPoints.levelTitle,
      unlockedPerks: getPerksForLevel(userPoints.currentLevel),
      nextPerks: getNextPerks(userPoints.currentLevel),
    };
  }

  /**
   * Seed achievements from definitions
   */
  async seedAchievements() {
    this.logger.log('Seeding achievements...');

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await this.prisma.achievement.upsert({
        where: { slug: def.slug },
        update: {
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          rarity: def.rarity,
          points: def.points,
          criteriaType: def.criteriaType,
          criteriaValue: def.criteriaValue,
          isSecret: def.isSecret || false,
          sortOrder: def.sortOrder || 0,
        },
        create: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          rarity: def.rarity,
          points: def.points,
          criteriaType: def.criteriaType,
          criteriaValue: def.criteriaValue,
          isSecret: def.isSecret || false,
          sortOrder: def.sortOrder || 0,
        },
      });
    }

    this.logger.log(`Seeded ${ACHIEVEMENT_DEFINITIONS.length} achievements`);
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats() {
    const [totalAchievements, byCategory, byRarity] = await Promise.all([
      this.prisma.achievement.count({ where: { isActive: true } }),
      this.prisma.achievement.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.achievement.groupBy({
        by: ['rarity'],
        where: { isActive: true },
        _count: true,
      }),
    ]);

    return {
      totalAchievements,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byRarity: byRarity.reduce((acc, item) => {
        acc[item.rarity] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  private getLevelMinPoints(level: number): number {
    const levelDefs = [0, 0, 50, 150, 350, 600, 1000, 1500, 2500, 4000, 6000];
    return levelDefs[level] || 0;
  }
}
