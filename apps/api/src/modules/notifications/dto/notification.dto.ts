import { IsBoolean, IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  NEW_VIDEO = 'NEW_VIDEO',
  UPCOMING_EVENT = 'UPCOMING_EVENT',
  WEEKLY_DIGEST = 'WEEKLY_DIGEST',
}

export enum NotificationFilter {
  ALL = 'all',
  UNREAD = 'unread',
  READ = 'read',
}

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Filter by read status', 
    enum: NotificationFilter,
    default: NotificationFilter.ALL 
  })
  @IsEnum(NotificationFilter)
  @IsOptional()
  filter?: NotificationFilter = NotificationFilter.ALL;

  @ApiPropertyOptional({ 
    description: 'Filter by notification type', 
    enum: NotificationType 
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: Record<string, unknown>;

  @ApiProperty()
  read: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Email notifications for new videos' })
  @IsBoolean()
  @IsOptional()
  emailNewVideo?: boolean;

  @ApiPropertyOptional({ description: 'Email notifications for upcoming events' })
  @IsBoolean()
  @IsOptional()
  emailUpcoming?: boolean;

  @ApiPropertyOptional({ description: 'Email weekly digest' })
  @IsBoolean()
  @IsOptional()
  emailWeeklyDigest?: boolean;

  @ApiPropertyOptional({ description: 'In-app notifications' })
  @IsBoolean()
  @IsOptional()
  inAppNotifications?: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  emailNewVideo: boolean;

  @ApiProperty()
  emailUpcoming: boolean;

  @ApiProperty()
  emailWeeklyDigest: boolean;

  @ApiProperty()
  inAppNotifications: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  data?: Record<string, unknown>;
}

export class NotificationStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  unread: number;
}
