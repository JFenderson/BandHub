import { ApiProperty } from '@nestjs/swagger';

export class QueueStatusDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  waiting: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  delayed: number;

  @ApiProperty()
  paused: boolean;
}

export class ErrorStatDto {
  @ApiProperty()
  errorMessage: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [String] })
  affectedBands: string[];

  @ApiProperty()
  lastOccurred: Date;
}

export class ErrorStatsResponseDto {
  @ApiProperty({ type: [ErrorStatDto] })
  errors: ErrorStatDto[];

  @ApiProperty()
  totalErrors: number;
}
