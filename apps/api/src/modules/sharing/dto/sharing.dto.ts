import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ContentType {
  VIDEO = 'video',
  BAND = 'band',
  PLAYLIST = 'playlist',
}

export enum SharePlatform {
  FACEBOOK = 'facebook',
  TWITTER = 'twitter',
  INSTAGRAM = 'instagram',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  COPY_LINK = 'copy_link',
  OTHER = 'other',
}

export class CreateShareDto {
  @ApiProperty({ enum: ContentType, description: 'Type of content being shared' })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty({ description: 'ID of the content being shared' })
  @IsString()
  contentId: string;

  @ApiProperty({ enum: SharePlatform, description: 'Platform where content is being shared' })
  @IsEnum(SharePlatform)
  platform: SharePlatform;
}

export class GetSharesQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  offset?: number = 0;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;
}
