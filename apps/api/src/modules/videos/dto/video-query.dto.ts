import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max } from 'class-validator';

export class VideoQueryDto {
  @ApiPropertyOptional({ description: 'Filter by band ID' })
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiPropertyOptional({ description: 'Filter by band slug' })
  @IsOptional()
  @IsString()
  bandSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Filter by content creator ID' })
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({ description: 'Filter by opponent band ID' })
  @IsOptional()
  @IsString()
  opponentBandId?: string;

  @ApiPropertyOptional({ description: 'Filter by event year' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  eventYear?: number;

  @ApiPropertyOptional({ description: 'Filter by event name' })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ description: 'Search query for titles and descriptions' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Include hidden videos (admin only)', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeHidden?: boolean = false;

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['publishedAt', 'viewCount', 'title', 'createdAt'] })
  @IsOptional()
  @IsEnum(['publishedAt', 'viewCount', 'title', 'createdAt'])
  sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt' = 'publishedAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}