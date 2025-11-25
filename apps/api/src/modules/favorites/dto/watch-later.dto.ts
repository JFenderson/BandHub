import { IsBoolean, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWatchLaterDto {
  @ApiPropertyOptional({ description: 'Mark video as watched' })
  @IsBoolean()
  @IsOptional()
  watched?: boolean;
}

export enum WatchLaterFilter {
  ALL = 'all',
  UNWATCHED = 'unwatched',
  WATCHED = 'watched',
}

export enum WatchLaterSortBy {
  RECENTLY_ADDED = 'recentlyAdded',
  OLDEST = 'oldest',
}

export class GetWatchLaterQueryDto {
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
    description: 'Filter by watch status', 
    enum: WatchLaterFilter,
    default: WatchLaterFilter.ALL 
  })
  @IsEnum(WatchLaterFilter)
  @IsOptional()
  filter?: WatchLaterFilter = WatchLaterFilter.ALL;

  @ApiPropertyOptional({ 
    description: 'Sort by', 
    enum: WatchLaterSortBy,
    default: WatchLaterSortBy.RECENTLY_ADDED 
  })
  @IsEnum(WatchLaterSortBy)
  @IsOptional()
  sortBy?: WatchLaterSortBy = WatchLaterSortBy.RECENTLY_ADDED;
}

export class WatchLaterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  videoId: string;

  @ApiProperty()
  watched: boolean;

  @ApiPropertyOptional()
  watchedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number;
    viewCount: number;
    publishedAt: Date;
    band: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string;
    };
  };
}

export class WatchLaterStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  watched: number;

  @ApiProperty()
  unwatched: number;
}
