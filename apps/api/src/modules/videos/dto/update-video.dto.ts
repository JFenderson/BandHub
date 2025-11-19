import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class UpdateVideoDto {
  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Opponent band ID' })
  @IsOptional()
  @IsString()
  opponentBandId?: string;

  @ApiPropertyOptional({ description: 'Event name' })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ description: 'Event year' })
  @IsOptional()
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  eventYear?: number;

  @ApiPropertyOptional({ description: 'Video tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Hide this video', default: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ description: 'Reason for hiding (if isHidden is true)' })
  @IsOptional()
  @IsString()
  hideReason?: string | null; // Allow null values

  @ApiPropertyOptional({ description: 'Quality score (1-10)', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'YouTube view count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  viewCount?: number;

  @ApiPropertyOptional({ description: 'YouTube like count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  likeCount?: number;
}