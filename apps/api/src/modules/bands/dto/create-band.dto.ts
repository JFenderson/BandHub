import { IsString, IsOptional, IsInt, IsArray, IsUrl, Min, Max, IsBoolean, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText, SanitizeDescription, SanitizeUrl, IsUSState, IsValidBandName, IsValidConference, IsYouTubeChannelId } from '../../../common';


export class CreateBandDto {
    @ApiProperty({ description: 'Band name' })
  @SanitizeText()  // ← Add this
  @IsValidBandName()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'School name' })
  @SanitizeText()  // ← Add this
  @IsOptional()
  @IsString()
  @MaxLength(255)
  schoolName?: string;

  @ApiPropertyOptional({ example: 'Jackson State University', description: 'School name (alias for schoolName)' })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional({ description: 'City' })
  @SanitizeText()  // ← Add this
  @IsOptional()
  @IsString()
  @MaxLength(255)
  city!: string;

  @ApiPropertyOptional({ description: 'State' })
  @SanitizeText()  // ← Add this
  @IsUSState()
  @IsOptional()
  @IsString()
  state!: string;

  @ApiPropertyOptional({ description: 'Conference' })
  @SanitizeText()  // ← Add this
  @IsValidConference()
  @IsOptional()
  @IsString()
  conference?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @SanitizeUrl()  // ← Add this
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Banner URL' })
  @SanitizeUrl()  // ← Add this 
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @SanitizeDescription()  // ← Add this (allows more content than Text)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 1946 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ example: 'UC1234567890' })
  @IsOptional()
  @IsYouTubeChannelId()
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

  @ApiPropertyOptional({ description: 'Band nickname' })
  @SanitizeText()  // ← Add this
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
  @SanitizeUrl()
  @IsUrl()
  website?: string;
}