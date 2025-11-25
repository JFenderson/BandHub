import { IsString, IsOptional, IsInt, IsArray, IsUrl, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBandDto {
  @ApiProperty({ example: 'Sonic Boom of the South' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Jackson State University' })
  @IsOptional()
  @IsString()
  schoolName?: string;

  @ApiPropertyOptional({ example: 'Jackson State University', description: 'School name (alias for schoolName)' })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiProperty({ example: 'Jackson' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'MS' })
  @IsString()
  state!: string;

  @ApiPropertyOptional({ example: 'SWAC' })
  @IsOptional()
  @IsString()
  conference?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ example: 'The Sonic Boom is known for...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1946 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ example: 'UC1234567890' })
  @IsOptional()
  @IsString()
  youtubeChannelId?: string;

  @ApiPropertyOptional({ example: ['PL1234', 'PL5678'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  youtubePlaylistIds?: string[];

  @ApiPropertyOptional({ description: 'Whether the band is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the band is featured', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // Fields that may be sent from frontend but are not in the Prisma schema
  // Marked as optional to accept them without validation errors

  @ApiPropertyOptional({ description: 'Band nickname (not persisted)' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: 'Division (not persisted)' })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ description: 'Founded year alias (not persisted)' })
  @IsOptional()
  @IsInt()
  founded?: number;

  @ApiPropertyOptional({ description: 'Band colors (not persisted)' })
  @IsOptional()
  @IsString()
  colors?: string;

  @ApiPropertyOptional({ description: 'Website URL (not persisted)' })
  @IsOptional()
  @IsString()
  website?: string;
}