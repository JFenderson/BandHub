import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailNotificationsDto {
  @ApiProperty({
    description: 'Receive notifications for new content',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  newContent?: boolean;

  @ApiProperty({
    description: 'Receive notifications for favorites',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  favorites?: boolean;

  @ApiProperty({
    description: 'Receive newsletter emails',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  newsletter?: boolean;

  @ApiProperty({
    description: 'Receive notifications for comments',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  comments?: boolean;

  @ApiProperty({
    description: 'Receive notifications for new followers',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  followers?: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Theme preference',
    enum: ['light', 'dark', 'auto'],
    example: 'dark',
    required: false,
  })
  @IsOptional()
  @IsEnum(['light', 'dark', 'auto'], { message: 'Theme must be light, dark, or auto' })
  theme?: 'light' | 'dark' | 'auto';

  @ApiProperty({
    description: 'Language preference',
    enum: ['en', 'es', 'fr'],
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsEnum(['en', 'es', 'fr'], { message: 'Language must be en, es, or fr' })
  language?: 'en' | 'es' | 'fr';

  @ApiProperty({
    description: 'Email notification preferences',
    type: EmailNotificationsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailNotificationsDto)
  emailNotifications?: EmailNotificationsDto;

  @ApiProperty({
    description: 'Autoplay videos',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoplay?: boolean;

  @ApiProperty({
    description: 'Default video quality',
    enum: ['auto', '360p', '480p', '720p', '1080p'],
    example: 'auto',
    required: false,
  })
  @IsOptional()
  @IsEnum(['auto', '360p', '480p', '720p', '1080p'], {
    message: 'Video quality must be auto, 360p, 480p, 720p, or 1080p',
  })
  videoQuality?: 'auto' | '360p' | '480p' | '720p' | '1080p';
}
