import { IsOptional, IsInt, Min, Max, IsEnum, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AchievementCategory, AchievementRarity } from '../achievement-definitions';

export class GetAchievementsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: AchievementCategory
  })
  @IsEnum(AchievementCategory)
  @IsOptional()
  category?: AchievementCategory;

  @ApiPropertyOptional({
    description: 'Filter by rarity',
    enum: AchievementRarity
  })
  @IsEnum(AchievementRarity)
  @IsOptional()
  rarity?: AchievementRarity;

  @ApiPropertyOptional({ description: 'Only show unlocked achievements' })
  @IsBoolean()
  @IsOptional()
  unlockedOnly?: boolean;
}

export class GetLeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Time period', enum: ['all', 'month', 'week'] })
  @IsString()
  @IsOptional()
  period?: 'all' | 'month' | 'week' = 'all';
}

export class AchievementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon: string;

  @ApiProperty({ enum: AchievementCategory })
  category: AchievementCategory;

  @ApiProperty({ enum: AchievementRarity })
  rarity: AchievementRarity;

  @ApiProperty()
  points: number;

  @ApiProperty()
  criteriaType: string;

  @ApiProperty()
  criteriaValue: number;

  @ApiPropertyOptional()
  progress?: number;

  @ApiPropertyOptional()
  unlockedAt?: Date;

  @ApiProperty()
  isUnlocked: boolean;
}

export class UserAchievementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  achievement: AchievementResponseDto;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  unlockedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class UserPointsResponseDto {
  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  currentLevel: number;

  @ApiProperty()
  levelTitle: string;

  @ApiProperty()
  achievementsUnlocked: number;

  @ApiProperty()
  nextLevelPoints: number;

  @ApiProperty()
  progressToNextLevel: number;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  currentLevel: number;

  @ApiProperty()
  levelTitle: string;

  @ApiProperty()
  achievementsUnlocked: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  data: LeaderboardEntryDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiPropertyOptional()
  currentUserRank?: number;
}

export class AchievementUnlockNotificationDto {
  @ApiProperty()
  achievementId: string;

  @ApiProperty()
  achievementName: string;

  @ApiProperty()
  achievementIcon: string;

  @ApiProperty()
  points: number;

  @ApiProperty({ enum: AchievementRarity })
  rarity: AchievementRarity;
}

export class UserBadgesResponseDto {
  @ApiProperty({ type: [AchievementResponseDto] })
  recentAchievements: AchievementResponseDto[];

  @ApiProperty({ type: [AchievementResponseDto] })
  featuredAchievements: AchievementResponseDto[];

  @ApiProperty()
  totalUnlocked: number;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  currentLevel: number;

  @ApiProperty()
  levelTitle: string;
}

export class PerksResponseDto {
  @ApiProperty()
  level: number;

  @ApiProperty()
  levelTitle: string;

  @ApiProperty({ type: [String] })
  unlockedPerks: string[];

  @ApiProperty({ type: [Object] })
  nextPerks: { level: number; perk: string }[];
}
