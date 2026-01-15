import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetReviewsQueryDto {
  @ApiPropertyOptional({ 
    description: 'Page number', 
    minimum: 1, 
    default: 1,
    example: 1 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of items per page', 
    minimum: 1, 
    maximum: 100,
    default: 20,
    example: 20 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Sort by field', 
    enum: ['createdAt', 'rating', 'helpful'],
    default: 'createdAt',
    example: 'createdAt' 
  })
  @IsOptional()
  @IsEnum(['createdAt', 'rating', 'helpful'])
  sortBy?: 'createdAt' | 'rating' | 'helpful' = 'createdAt';

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc' 
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ 
    description: 'Filter by rating (1-5)', 
    minimum: 1, 
    maximum: 5,
    example: 5 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Transform(({ value }) => parseInt(value, 10))
  rating?: number;
}
