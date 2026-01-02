/**
 * Example: Updated VideoQueryDto with Sanitization
 * 
 * This shows how to sanitize query parameters and search inputs.
 * Query parameters are a common XSS attack vector.
 * 
 * File: apps/api/src/modules/videos/dto/video-query.dto.ts
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SanitizeSearch, SanitizeText } from '../common';

enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

enum SortField {
  PUBLISHED_AT = 'publishedAt',
  CREATED_AT = 'createdAt',
  VIEW_COUNT = 'viewCount',
  TITLE = 'title',
}

export class VideoQueryDto {
  @ApiPropertyOptional({ 
    description: 'Search query for video titles and descriptions',
    example: 'halftime show'
  })
  @SanitizeSearch() // Removes dangerous patterns from search queries
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by band ID',
    example: 'clh8x9k2t0000ue08j5k3l9mn'
  })
  @SanitizeText() // Sanitize IDs to prevent injection
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by opponent band ID',
    example: 'clh8x9k2t0001ue08j5k3l9mo'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  opponentBandId?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by category ID',
    example: 'clh8x9k2t0002ue08j5k3l9mp'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by year',
    example: 2023
  })
  @IsOptional()
  @IsInt()
  @Min(2005)
  @Max(2030)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ 
    description: 'Filter by event name',
    example: 'Honda Battle of the Bands'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ 
    description: 'Sort field',
    enum: SortField,
    default: SortField.PUBLISHED_AT
  })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.PUBLISHED_AT;

  @ApiPropertyOptional({ 
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ 
    description: 'Page number',
    default: 1,
    minimum: 1
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}