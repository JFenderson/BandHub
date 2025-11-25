import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFavoriteVideoDto {
  @ApiPropertyOptional({ description: 'Optional notes about the video' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateFavoriteVideoDto {
  @ApiPropertyOptional({ description: 'Notes about the video' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export enum FavoriteVideoSortBy {
  RECENTLY_ADDED = 'recentlyAdded',
  OLDEST = 'oldest',
  MOST_VIEWED = 'mostViewed',
}

export class GetFavoriteVideosQueryDto {
  @ApiPropertyOptional({ description: 'Filter by band ID' })
  @IsString()
  @IsOptional()
  bandId?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

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
    enum: FavoriteVideoSortBy,
    default: FavoriteVideoSortBy.RECENTLY_ADDED 
  })
  @IsEnum(FavoriteVideoSortBy)
  @IsOptional()
  sortBy?: FavoriteVideoSortBy = FavoriteVideoSortBy.RECENTLY_ADDED;
}

export class FavoriteVideoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  videoId: string;

  @ApiPropertyOptional()
  notes?: string;

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
    category?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}
