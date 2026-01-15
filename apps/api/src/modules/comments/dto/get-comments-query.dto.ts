import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetCommentsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Sort by newest, oldest, or popular (most liked)', 
    enum: ['newest', 'oldest', 'popular'],
    default: 'newest'
  })
  @IsOptional()
  @IsEnum(['newest', 'oldest', 'popular'])
  sortBy?: 'newest' | 'oldest' | 'popular' = 'newest';
}
