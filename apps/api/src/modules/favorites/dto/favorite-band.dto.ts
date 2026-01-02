import { IsBoolean, IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeSearch } from 'src/common';

export class UpdateFavoriteBandDto {
  @ApiPropertyOptional({ description: 'Enable notifications for this band' })
  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;
}

export enum FavoriteBandSortBy {
  RECENTLY_FOLLOWED = 'recentlyFollowed',
  NAME = 'name',
  VIDEO_COUNT = 'videoCount',
}

export class GetFavoriteBandsQueryDto {
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
    description: 'Sort by', 
    enum: FavoriteBandSortBy,
    default: FavoriteBandSortBy.RECENTLY_FOLLOWED 
  })
  @IsEnum(FavoriteBandSortBy)
  @IsOptional()
  sortBy?: FavoriteBandSortBy = FavoriteBandSortBy.RECENTLY_FOLLOWED;

  @ApiPropertyOptional({ description: 'Search by band name' })
  @SanitizeSearch()
  @IsString()
  @IsOptional()
  search?: string;
}

export class FavoriteBandResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bandId: string;

  @ApiProperty()
  notificationsEnabled: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  band: {
    id: string;
    name: string;
    slug: string;
    schoolName: string;
    logoUrl?: string;
    state: string;
    _count: {
      videos: number;
    };
    latestVideo?: {
      id: string;
      title: string;
      thumbnailUrl: string;
      publishedAt: Date;
    };
  };
}
