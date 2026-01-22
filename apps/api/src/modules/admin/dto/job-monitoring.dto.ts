import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsObject, IsBoolean, IsString, Min } from 'class-validator';
import { JobPriority } from '@hbcu-band-hub/shared-types';

export class QueueMetricsDto {
  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ description: 'Number of jobs waiting' })
  waiting: number;

  @ApiProperty({ description: 'Number of jobs currently active' })
  active: number;

  @ApiProperty({ description: 'Number of completed jobs' })
  completed: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  failed: number;

  @ApiProperty({ description: 'Number of delayed jobs' })
  delayed: number;

  @ApiProperty({ description: 'Whether the queue is paused' })
  paused: boolean;
}

export class JobMetricsDto {
  @ApiProperty({ description: 'Timestamp of metrics' })
  timestamp: Date;

  @ApiProperty({ description: 'Metrics for each queue', type: [QueueMetricsDto] })
  queues: QueueMetricsDto[];

  @ApiProperty({ description: 'Total counts across all queues' })
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };

  @ApiProperty({ description: 'Success rate percentage (0-100)' })
  successRate: number;

  @ApiProperty({ description: 'Jobs processed per minute' })
  processingRate: number;
}

export class JobTrendDto {
  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ description: 'Time period', enum: ['24h', '7d', '30d'] })
  period: '24h' | '7d' | '30d';

  @ApiProperty({ description: 'Number of successful jobs' })
  successful: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  failed: number;

  @ApiProperty({ description: 'Total jobs in period' })
  total: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Average processing time in milliseconds' })
  avgProcessingTime: number;
}

export class StuckJobAlertDto {
  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ description: 'Job name/type' })
  jobName: string;

  @ApiProperty({ description: 'Duration stuck in milliseconds' })
  stuckDuration: number;

  @ApiProperty({ description: 'Alert severity', enum: ['low', 'medium', 'high', 'critical'] })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ description: 'When the job started processing' })
  startedAt: Date;

  @ApiProperty({ description: 'Job data payload' })
  data: any;

  @ApiProperty({ description: 'Number of attempts made' })
  attemptsMade: number;
}

export class QueueControlDto {
  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ description: 'Action performed' })
  action: string;

  @ApiProperty({ description: 'Timestamp of action' })
  timestamp: Date;

  @ApiProperty({ description: 'Whether action was successful' })
  success: boolean;
}

export class JobRetryDto {
  @ApiPropertyOptional({ description: 'Job priority', enum: JobPriority })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({ description: 'Number of retry attempts', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  attempts?: number;

  @ApiPropertyOptional({ description: 'Backoff configuration' })
  @IsOptional()
  @IsObject()
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };

  @ApiPropertyOptional({ description: 'Data overrides for the retry' })
  @IsOptional()
  @IsObject()
  dataOverrides?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Remove original failed job', default: true })
  @IsOptional()
  @IsBoolean()
  removeOriginal?: boolean;
}
