import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, IsUrl, Min, Max } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ description: 'YouTube video ID' })
  @IsString()
  youtubeId!: string;

  @ApiProperty({ description: 'Video title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Video description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Video duration in seconds' })
  @IsNumber()
  @Min(1)
  duration!: number;

  @ApiProperty({ description: 'Video thumbnail URL' })
  @IsUrl()
  thumbnailUrl!: string;

  @ApiProperty({ description: 'YouTube view count' })
  @IsNumber()
  @Min(0)
  viewCount!: number;

  @ApiProperty({ description: 'YouTube like count' })
  @IsNumber()
  @Min(0)
  likeCount!: number;

  @ApiProperty({ description: 'Video published date' })
  @IsString()
  publishedAt!: string; // Will be converted to Date

  @ApiProperty({ description: 'Band ID this video belongs to' })
  @IsString()
  bandId!: string;

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

  @ApiPropertyOptional({ description: 'Quality score (1-10)', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  qualityScore?: number;
}