import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export enum BulkVideoAction {
  CATEGORIZE = 'categorize',
  HIDE = 'hide',
  UNHIDE = 'unhide',
  DELETE = 'delete',
  UPDATE_METADATA = 'update_metadata',
}

export class BulkVideoUpdateDto {
  @ApiProperty({ description: 'Array of video IDs to update', type: [String] })
  @IsArray()
  @IsString({ each: true })
  videoIds: string[];

  @ApiProperty({ description: 'Bulk action to perform', enum: BulkVideoAction })
  @IsEnum(BulkVideoAction)
  action: BulkVideoAction;

  @ApiPropertyOptional({ description: 'Category ID (for categorize action)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Hide reason (for hide action)' })
  @IsOptional()
  @IsString()
  hideReason?: string;

  @ApiPropertyOptional({ description: 'Opponent band ID (for metadata update)' })
  @IsOptional()
  @IsString()
  opponentBandId?: string;

  @ApiPropertyOptional({ description: 'Event name (for metadata update)' })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ description: 'Event year (for metadata update)' })
  @IsOptional()
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  eventYear?: number;

  @ApiPropertyOptional({ description: 'Tags (comma-separated, for metadata update)' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Quality score (for metadata update)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;
}

export class BulkVideoUpdateResponseDto {
  @ApiProperty({ description: 'Number of videos successfully updated' })
  successCount: number;

  @ApiProperty({ description: 'Number of videos that failed to update' })
  failedCount: number;

  @ApiProperty({ description: 'Array of video IDs that were successfully updated', type: [String] })
  successfulIds: string[];

  @ApiProperty({ description: 'Array of video IDs that failed to update', type: [String] })
  failedIds: string[];

  @ApiPropertyOptional({ description: 'Error messages for failed updates' })
  errors?: { [videoId: string]: string };
}
