import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SyncStatus } from '@prisma/client';

export class YouTubeVideoQueryDto {
  @ApiPropertyOptional({ description: 'Filter by band ID' })
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiPropertyOptional({ description: 'Filter by creator ID' })
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({ description: 'Filter by YouTube channel ID' })
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Search in title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter videos published after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  publishedAfter?: string;

  @ApiPropertyOptional({ description: 'Filter videos published before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  publishedBefore?: string;

  @ApiPropertyOptional({ enum: SyncStatus, description: 'Filter by sync status' })
  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @ApiPropertyOptional({ description: 'Filter by promoted status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPromoted?: boolean;

  @ApiPropertyOptional({
    enum: ['publishedAt', 'viewCount', 'qualityScore', 'createdAt'],
    default: 'publishedAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'publishedAt' | 'viewCount' | 'qualityScore' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class YouTubeVideoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  youtubeId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  thumbnailUrl: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  publishedAt: Date;

  @ApiProperty()
  viewCount: number;

  @ApiProperty()
  likeCount: number;

  @ApiProperty()
  channelId: string;

  @ApiPropertyOptional()
  channelTitle?: string;

  @ApiPropertyOptional()
  bandId?: string;

  @ApiPropertyOptional()
  creatorId?: string;

  @ApiProperty({ enum: SyncStatus })
  syncStatus: SyncStatus;

  @ApiPropertyOptional()
  lastSyncedAt?: Date;

  @ApiProperty()
  isPromoted: boolean;

  @ApiProperty()
  qualityScore: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Associated band details' })
  band?: {
    id: string;
    name: string;
    slug: string;
    schoolName: string;
    logoUrl?: string;
  };

  @ApiPropertyOptional({ description: 'Associated creator details' })
  creator?: {
    id: string;
    name: string;
    logoUrl?: string;
    thumbnailUrl?: string;
    isVerified: boolean;
  };
}

export class YouTubeVideoListResponseDto {
  @ApiProperty({ type: [YouTubeVideoResponseDto] })
  data: YouTubeVideoResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class TriggerSyncDto {
  @ApiPropertyOptional({ description: 'Whether to force a full sync instead of incremental' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  fullSync?: boolean;

  @ApiPropertyOptional({ description: 'Only sync videos published after this date' })
  @IsOptional()
  @IsDateString()
  publishedAfter?: string;

  @ApiPropertyOptional({ description: 'Maximum number of videos to sync' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxVideos?: number;
}

export class SyncStatusResponseDto {
  @ApiProperty()
  totalBands: number;

  @ApiProperty()
  totalCreators: number;

  @ApiProperty()
  totalYouTubeVideos: number;

  @ApiProperty()
  totalCuratedVideos: number;

  @ApiProperty()
  dailyQuotaUsed: number;

  @ApiProperty()
  dailyQuotaLimit: number;

  @ApiProperty()
  dailyQuotaRemaining: number;

  @ApiProperty()
  lastSyncAt?: Date;

  @ApiProperty()
  recentSyncJobs: {
    id: string;
    entityName: string;
    entityType: 'band' | 'creator';
    status: string;
    videosAdded: number;
    quotaUsed: number;
    createdAt: Date;
    completedAt?: Date;
  }[];
}

export class YouTubeVideoStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  byBandCount: number;

  @ApiProperty()
  byCreatorCount: number;

  @ApiProperty()
  bySyncStatus: {
    status: SyncStatus;
    count: number;
  }[];
}
