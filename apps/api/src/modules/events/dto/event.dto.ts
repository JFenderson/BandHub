import { IsString, IsOptional, IsEnum, IsDateString, IsInt, IsBoolean, IsArray, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { SanitizeSearch } from 'src/common';

export class CreateEventDto {
  @ApiProperty({ description: 'Event name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event type', enum: EventType })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ description: 'Event date (ISO 8601)' })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({ description: 'Event end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Event location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Venue name' })
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Event year' })
  @IsInt()
  year: number;

  @ApiPropertyOptional({ description: 'Is this a recurring event?' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Event image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Event name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Event type', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Event date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Event end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Event location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Venue name' })
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Event year' })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Is this a recurring event?' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Is the event active?' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Event image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class EventFilterDto {
  @ApiPropertyOptional({ description: 'Filter by event type', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Filter by year' })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Filter by state' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Search query' })
  @SanitizeSearch()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', default: 20 })
  @IsOptional()
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: 'eventDate' | 'name' | 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class AddEventVideoDto {
  @ApiProperty({ description: 'Video ID to associate' })
  @IsString()
  videoId: string;
}

export class AddEventBandDto {
  @ApiProperty({ description: 'Band ID to associate' })
  @IsString()
  bandId: string;

  @ApiPropertyOptional({ description: 'Band role in event (e.g., home, away, participant)' })
  @IsOptional()
  @IsString()
  role?: string;
}
