import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray, IsUrl, IsNumber, Min } from 'class-validator';

export class UpdateBandDto {
  @ApiPropertyOptional({ description: 'Band name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug (auto-generated from name)' })
  @IsOptional()
  @IsString()
  slug?: string; // Add this property

  @ApiPropertyOptional({ description: 'School name' })
  @IsOptional()
  @IsString()
  schoolName?: string;

  @ApiPropertyOptional({ description: 'School name (alias for schoolName)' })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional({ description: 'City where the school is located' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State where the school is located' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Conference affiliation' })
  @IsOptional()
  @IsString()
  conference?: string;

  @ApiPropertyOptional({ description: 'Band logo URL' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Band description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Year the band was founded' })
  @IsOptional()
  @IsNumber()
  @Min(1800)
  foundedYear?: number;

  @ApiPropertyOptional({ description: 'YouTube channel ID' })
  @IsOptional()
  @IsString()
  youtubeChannelId?: string;

  @ApiPropertyOptional({ description: 'YouTube playlist IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  youtubePlaylistIds?: string[];

  @ApiPropertyOptional({ description: 'Whether the band is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the band is featured' })
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
  @IsNumber()
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