import { IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum WatchHistoryFilter {
  ALL = 'all',
  COMPLETED = 'completed',
  INCOMPLETE = 'incomplete',
}

export enum WatchHistorySortBy {
  RECENTLY_WATCHED = 'recentlyWatched',
  OLDEST = 'oldest',
  MOST_VIEWED = 'mostViewed',
  LONGEST_DURATION = 'longestDuration',
}

export class GetWatchHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by completion status',
    enum: WatchHistoryFilter,
    default: WatchHistoryFilter.ALL,
  })
  @IsEnum(WatchHistoryFilter)
  @IsOptional()
  filter?: WatchHistoryFilter = WatchHistoryFilter.ALL;

  @ApiPropertyOptional({
    description: 'Sort by',
    enum: WatchHistorySortBy,
    default: WatchHistorySortBy.RECENTLY_WATCHED,
  })
  @IsEnum(WatchHistorySortBy)
  @IsOptional()
  sortBy?: WatchHistorySortBy = WatchHistorySortBy.RECENTLY_WATCHED;
}
