import { IsOptional, IsEnum, IsString, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SyncJobStatus, SyncJobType } from '@prisma/client';

export class SyncJobFilterDto {
  @ApiPropertyOptional({ description: 'Filter by job status' })
  @IsOptional()
  @IsEnum(SyncJobStatus)
  status?: SyncJobStatus;

  @ApiPropertyOptional({ description: 'Filter by job type' })
  @IsOptional()
  @IsEnum(SyncJobType)
  jobType?: SyncJobType;

  @ApiPropertyOptional({ description: 'Filter by band ID' })
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiPropertyOptional({ description: 'Filter jobs created after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter jobs created before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort by field', enum: ['createdAt', 'startedAt', 'completedAt'] })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'startedAt' | 'completedAt' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
