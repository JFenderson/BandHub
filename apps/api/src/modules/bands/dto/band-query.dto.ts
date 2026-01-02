import { IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SanitizeSearch } from 'src/common';

export class BandQueryDto {
  @ApiPropertyOptional({ example: 'SWAC' })
  @IsOptional()
  @IsString()
  conference?: string;

  @ApiPropertyOptional({ example: 'MS' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 'jackson' })
@SanitizeSearch()
@IsString()
@IsOptional()
search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'name', enum: ['name', 'schoolName', 'createdAt'] })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'schoolName' | 'createdAt' = 'name';

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}