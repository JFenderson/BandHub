import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TriggerSyncType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
}

export class TriggerSyncDto {
  @ApiPropertyOptional({ description: 'Specific band ID to sync (leave empty for all bands)' })
  @IsOptional()
  @IsString()
  bandId?: string;

  @ApiProperty({ description: 'Sync type', enum: TriggerSyncType, default: TriggerSyncType.INCREMENTAL })
  @IsEnum(TriggerSyncType)
  syncType: TriggerSyncType = TriggerSyncType.INCREMENTAL;

  @ApiPropertyOptional({ description: 'Force sync even if recently synced', default: false })
  @IsOptional()
  @IsBoolean()
  forceSync?: boolean = false;
}
