import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max, IsDateString } from 'class-validator';

export class AdminVideoQueryDto {
  @ApiPropertyOptional({ description: 'Filter by band ID' })
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

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

  @ApiPropertyOptional({ description: 'Filter by hidden status', enum: ['all', 'visible', 'hidden'] })
  @IsOptional()
  @IsEnum(['all', 'visible', 'hidden'])
  hiddenStatus?: 'all' | 'visible' | 'hidden' = 'all';

  @ApiPropertyOptional({ description: 'Filter by categorization status', enum: ['all', 'categorized', 'uncategorized'] })
  @IsOptional()
  @IsEnum(['all', 'categorized', 'uncategorized'])
  categorizationStatus?: 'all' | 'categorized' | 'uncategorized' = 'all';

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['publishedAt', 'viewCount', 'title', 'createdAt', 'updatedAt'] })
  @IsOptional()
  @IsEnum(['publishedAt', 'viewCount', 'title', 'createdAt', 'updatedAt'])
  sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt' | 'updatedAt' = 'publishedAt';

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
