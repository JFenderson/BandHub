import { ApiProperty } from '@nestjs/swagger';
import { SyncJobStatus, SyncJobType } from '@prisma/client';

export class SyncJobDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  bandId?: string;

  @ApiProperty({ required: false })
  bandName?: string;

  @ApiProperty({ enum: SyncJobType })
  jobType: SyncJobType;

  @ApiProperty({ enum: SyncJobStatus })
  status: SyncJobStatus;

  @ApiProperty()
  videosFound: number;

  @ApiProperty()
  videosAdded: number;

  @ApiProperty()
  videosUpdated: number;

  @ApiProperty({ type: [String] })
  errors: string[];

  @ApiProperty({ required: false })
  startedAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  duration?: number; // in milliseconds

  @ApiProperty({ required: false })
  queuePosition?: number; // position in queue if waiting
}

export class SyncJobListResponseDto {
  @ApiProperty({ type: [SyncJobDetailDto] })
  data: SyncJobDetailDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
