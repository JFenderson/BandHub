import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateCreatorDto {
  @ApiProperty({ description: 'Creator or channel name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'YouTube channel ID' })
  @IsString()
  youtubeChannelId!: string;

  @ApiProperty({ description: 'Full YouTube channel URL' })
  @IsString()
  @IsUrl()
  channelUrl!: string;

  @ApiPropertyOptional({ description: 'Creator description/bio' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Custom logo URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'YouTube thumbnail URL as fallback' })
  @IsOptional()
  @IsString()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Quality score between 0-100', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number = 0;

  @ApiPropertyOptional({ description: 'Mark as verified creator', default: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean = false;

  @ApiPropertyOptional({ description: 'Mark as featured creator', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;
}
