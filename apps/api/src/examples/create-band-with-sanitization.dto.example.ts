/**
 * Example: Updated CreateBandDto with Sanitization
 * 
 * This shows how to apply sanitization decorators to your existing DTOs.
 * The decorators work alongside existing class-validator decorators.
 * 
 * File: apps/api/src/modules/bands/dto/create-band.dto.ts
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, IsUrl } from 'class-validator';
import { SanitizeText, SanitizeDescription, SanitizeUrl } from '../common';

export class CreateBandDto {
  @ApiProperty({ 
    description: 'Band name',
    example: 'Southern University Human Jukebox'
  })
  @SanitizeText() // Applies STRICT sanitization for band names
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ 
    description: 'School/university name',
    example: 'Southern University and A&M College'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  schoolName?: string;

  @ApiPropertyOptional({ 
    description: 'Band nickname',
    example: 'The Human Jukebox'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({ 
    description: 'City location',
    example: 'Baton Rouge'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ 
    description: 'State location',
    example: 'Louisiana'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ 
    description: 'Athletic conference',
    example: 'SWAC'
  })
  @SanitizeText()
  @IsOptional()
  @IsString()
  conference?: string;

  @ApiPropertyOptional({ 
    description: 'Band description/bio',
    example: 'The Human Jukebox is known for their high-energy performances and innovative choreography.'
  })
  @SanitizeDescription() // Allows basic text, removes HTML
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Official band website URL',
    example: 'https://www.subr.edu/page/human-jukebox'
  })
  @SanitizeUrl() // Validates and sanitizes URLs
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ 
    description: 'YouTube channel URL',
    example: 'https://www.youtube.com/@HumanJukebox'
  })
  @SanitizeUrl({ allowedDomains: ['youtube.com', 'youtu.be'] })
  @IsOptional()
  @IsUrl()
  youtubeUrl?: string;

  @ApiPropertyOptional({ 
    description: 'Band logo URL',
    example: 'https://example.com/logos/southern.png'
  })
  @SanitizeUrl()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ 
    description: 'Mark as featured band',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Featured order position (1-8)',
    example: 1
  })
  @IsOptional()
  featuredOrder?: number;
}