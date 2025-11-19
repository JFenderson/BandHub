import { IsString, IsOptional, IsInt, IsArray, IsUrl, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBandDto {
  @ApiProperty({ example: 'Sonic Boom of the South' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Jackson State University' })
  @IsString()
  schoolName!: string;

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
}