/**
 * Data Transfer Objects for YouTube Quota Management
 * 
 * File: apps/api/src/youtube/dto/quota-analytics.dto.ts
 * 
 * These DTOs define the shape of data for:
 * - Quota status responses
 * - Analytics reports
 * - Alert notifications
 * - Admin dashboard data
 */

import { IsEnum, IsNumber, IsString, IsBoolean, IsOptional, IsDate, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { QuotaAlertLevel, SyncPriority } from '../interfaces/quota.interface';

/**
 * DTO for quota status endpoint
 */
export class QuotaStatusDto {
  @ApiProperty({ example: 2500, description: 'Current quota usage for today' })
  @IsNumber()
  currentUsage: number;

  @ApiProperty({ example: 10000, description: 'Daily quota limit' })
  @IsNumber()
  limit: number;

  @ApiProperty({ example: 7500, description: 'Remaining quota for today' })
  @IsNumber()
  remaining: number;

  @ApiProperty({ example: 25.0, description: 'Percentage of quota used' })
  @IsNumber()
  percentageUsed: number;

  @ApiProperty({ enum: QuotaAlertLevel, example: QuotaAlertLevel.INFO })
  @IsEnum(QuotaAlertLevel)
  alertLevel: QuotaAlertLevel;

  @ApiProperty({ example: '2025-01-02T08:00:00.000Z', description: 'Next quota reset time' })
  @Type(() => Date)
  @IsDate()
  resetTime: Date;

  @ApiProperty({ example: false, description: 'Whether emergency mode is active' })
  @IsBoolean()
  isEmergencyMode: boolean;

  @ApiProperty({ example: '2025-01-01T14:30:00.000Z', description: 'Last update timestamp' })
  @Type(() => Date)
  @IsDate()
  lastUpdated: Date;
}

/**
 * DTO for operation breakdown
 */
export class OperationBreakdownDto {
  @ApiProperty({ example: 'search', description: 'YouTube API operation type' })
  @IsString()
  operation: string;

  @ApiProperty({ example: 1500, description: 'Total quota cost for this operation' })
  @IsNumber()
  totalCost: number;

  @ApiProperty({ example: 15, description: 'Number of times this operation was called' })
  @IsNumber()
  count: number;

  @ApiProperty({ example: 100, description: 'Average cost per call' })
  @IsNumber()
  averageCost: number;
}

/**
 * DTO for top quota consumers
 */
export class TopConsumerDto {
  @ApiProperty({ example: 'cm1abc123', description: 'Band ID' })
  @IsString()
  bandId: string;

  @ApiProperty({ example: 'Southern University', description: 'Band name' })
  @IsString()
  bandName: string;

  @ApiProperty({ example: 450, description: 'Quota used by this band today' })
  @IsNumber()
  quotaUsed: number;

  @ApiProperty({ example: 18.0, description: 'Percentage of total quota' })
  @IsNumber()
  percentageOfTotal: number;
}

/**
 * DTO for historical data
 */
export class HistoricalDataDto {
  @ApiProperty({ example: 6500, description: 'Average daily usage' })
  @IsNumber()
  averageDaily: number;

  @ApiProperty({ example: 9200, description: 'Peak daily usage' })
  @IsNumber()
  peakDaily: number;

  @ApiProperty({ example: 45500, description: 'Total usage in period' })
  @IsNumber()
  totalUsed: number;

  @ApiProperty({ enum: ['increasing', 'decreasing', 'stable'], example: 'stable' })
  @IsString()
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * DTO for cache efficiency stats
 */
export class CacheEfficiencyDto {
  @ApiProperty({ example: 0.75, description: 'Cache hit rate (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  cacheHitRate: number;

  @ApiProperty({ example: 3500, description: 'Quota saved by cache today' })
  @IsNumber()
  quotaSavedByCache: number;

  @ApiProperty({ example: 125, description: 'Average quota cost per sync job' })
  @IsNumber()
  averageCostPerSync: number;

  @ApiProperty({ type: [OperationBreakdownDto], description: 'Most expensive operations' })
  mostExpensiveOperations: OperationBreakdownDto[];
}

/**
 * DTO for usage forecast
 */
export class ForecastDto {
  @ApiProperty({ example: 6800, description: 'Estimated daily usage' })
  @IsNumber()
  estimatedDailyUsage: number;

  @ApiProperty({ example: 204000, description: 'Projected monthly usage' })
  @IsNumber()
  projectedMonthlyUsage: number;

  @ApiProperty({ enum: ['low', 'medium', 'high'], example: 'medium' })
  @IsString()
  riskLevel: 'low' | 'medium' | 'high';

  @ApiProperty({ example: ['Monitor usage during peak hours'], description: 'Optimization recommendations' })
  @IsString({ each: true })
  recommendations: string[];
}

/**
 * DTO for comprehensive quota analytics
 */
export class QuotaAnalyticsDto {
  @ApiProperty({ type: Object, description: 'Today\'s quota usage' })
  today: {
    used: number;
    remaining: number;
    percentageUsed: number;
    operationBreakdown: Record<string, number>;
    topConsumers: TopConsumerDto[];
  };

  @ApiProperty({ type: HistoricalDataDto, description: 'Last 7 days statistics' })
  last7Days: HistoricalDataDto;

  @ApiProperty({ type: HistoricalDataDto, description: 'Last 30 days statistics' })
  last30Days: HistoricalDataDto;

  @ApiProperty({ type: CacheEfficiencyDto, description: 'Cache efficiency metrics' })
  efficiency: CacheEfficiencyDto;

  @ApiProperty({ type: ForecastDto, description: 'Usage forecast and recommendations' })
  forecast: ForecastDto;
}

/**
 * DTO for quota alert
 */
export class QuotaAlertDto {
  @ApiProperty({ example: 'alert-1234567890', description: 'Alert ID' })
  @IsString()
  id: string;

  @ApiProperty({ enum: QuotaAlertLevel, example: QuotaAlertLevel.WARNING })
  @IsEnum(QuotaAlertLevel)
  level: QuotaAlertLevel;

  @ApiProperty({ example: 'Quota usage at 55.0% (5500/10000)', description: 'Alert message' })
  @IsString()
  message: string;

  @ApiProperty({ example: 5500, description: 'Current quota usage when alert triggered' })
  @IsNumber()
  currentUsage: number;

  @ApiProperty({ example: '2025-01-01T14:30:00.000Z', description: 'Alert timestamp' })
  @Type(() => Date)
  @IsDate()
  timestamp: Date;

  @ApiProperty({ example: false, description: 'Whether alert has been acknowledged' })
  @IsBoolean()
  acknowledged: boolean;

  @ApiProperty({ example: '2025-01-01T15:00:00.000Z', required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  acknowledgedAt?: Date;

  @ApiProperty({ example: 'admin@example.com', required: false })
  @IsString()
  @IsOptional()
  acknowledgedBy?: string;
}

/**
 * DTO for quota approval request
 */
export class QuotaApprovalRequestDto {
  @ApiProperty({ example: 'cm1abc123', description: 'Band ID for sync job' })
  @IsString()
  bandId: string;

  @ApiProperty({ enum: SyncPriority, example: SyncPriority.HIGH })
  @IsEnum(SyncPriority)
  priority: SyncPriority;

  @ApiProperty({ example: 350, description: 'Estimated quota cost for the sync job' })
  @IsNumber()
  @Min(0)
  estimatedCost: number;

  @ApiProperty({ example: true, required: false, description: 'Force approval even if quota low' })
  @IsBoolean()
  @IsOptional()
  forceApprove?: boolean;
}

/**
 * DTO for quota approval response
 */
export class QuotaApprovalResponseDto {
  @ApiProperty({ example: true, description: 'Whether quota was approved' })
  @IsBoolean()
  approved: boolean;

  @ApiProperty({ example: 350, description: 'Estimated quota cost' })
  @IsNumber()
  estimatedCost: number;

  @ApiProperty({ example: 2800, description: 'Allocated quota for this priority level' })
  @IsNumber()
  allocatedQuota: number;

  @ApiProperty({ example: 7500, description: 'Remaining quota available' })
  @IsNumber()
  remainingQuota: number;

  @ApiProperty({ example: 'Approved within allocated quota', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ example: '2025-01-01T14:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  timestamp: Date;
}

/**
 * DTO for sync job cost estimation request
 */
export class EstimateSyncCostDto {
  @ApiProperty({ example: true, description: 'Whether band has YouTube channel ID' })
  @IsBoolean()
  hasChannelId: boolean;

  @ApiProperty({ example: 150, description: 'Estimated number of videos' })
  @IsNumber()
  @Min(0)
  estimatedVideoCount: number;

  @ApiProperty({ example: false, description: 'Whether to use search-based sync' })
  @IsBoolean()
  useSearch: boolean;

  @ApiProperty({ example: 3, required: false, description: 'Number of search queries if using search' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  searchQueriesCount?: number;
}

/**
 * DTO for cost estimation response
 */
export class CostEstimationResponseDto {
  @ApiProperty({ example: 325, description: 'Estimated total quota cost' })
  @IsNumber()
  estimatedCost: number;

  @ApiProperty({ type: Object, description: 'Breakdown by operation type' })
  breakdown: {
    search?: number;
    channelList?: number;
    playlistItems?: number;
    videoList?: number;
  };

  @ApiProperty({ example: 'Channel-based sync (efficient)', description: 'Sync method description' })
  @IsString()
  syncMethod: string;

  @ApiProperty({ example: false, description: 'Whether this cost is high compared to average' })
  @IsBoolean()
  isHighCost: boolean;
}

/**
 * DTO for acknowledging an alert
 */
export class AcknowledgeAlertDto {
  @ApiProperty({ example: 'alert-1234567890', description: 'Alert ID to acknowledge' })
  @IsString()
  alertId: string;

  @ApiProperty({ example: 'admin@example.com', description: 'Who acknowledged the alert' })
  @IsString()
  acknowledgedBy: string;
}

/**
 * DTO for quota history query parameters
 */
export class QuotaHistoryQueryDto {
  @ApiProperty({ example: 7, required: false, description: 'Number of days to retrieve' })
  @IsNumber()
  @Min(1)
  @Max(90)
  @IsOptional()
  days?: number;

  @ApiProperty({ example: 'cm1abc123', required: false, description: 'Filter by band ID' })
  @IsString()
  @IsOptional()
  bandId?: string;

  @ApiProperty({ example: 'search', required: false, description: 'Filter by operation type' })
  @IsString()
  @IsOptional()
  operation?: string;
}

/**
 * DTO for quota usage record
 */
export class QuotaUsageRecordDto {
  @ApiProperty({ example: 'log-1234567890', description: 'Usage log ID' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'search', description: 'Operation type' })
  @IsString()
  operation: string;

  @ApiProperty({ example: 100, description: 'Quota cost' })
  @IsNumber()
  cost: number;

  @ApiProperty({ example: '2025-01-01T14:30:00.000Z', description: 'Operation timestamp' })
  @Type(() => Date)
  @IsDate()
  timestamp: Date;

  @ApiProperty({ example: 'cm1abc123', required: false })
  @IsString()
  @IsOptional()
  bandId?: string;

  @ApiProperty({ example: 'Southern University', required: false })
  @IsString()
  @IsOptional()
  bandName?: string;

  @ApiProperty({ example: true, description: 'Whether operation succeeded' })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ example: false, description: 'Whether result was from cache' })
  @IsBoolean()
  cacheHit: boolean;
}

/**
 * DTO for daily summary
 */
export class DailySummaryDto {
  @ApiProperty({ example: '2025-01-01', description: 'Date in YYYY-MM-DD format' })
  @IsString()
  date: string;

  @ApiProperty({ example: 6500, description: 'Total quota used on this day' })
  @IsNumber()
  totalUsage: number;

  @ApiProperty({ example: 10000, description: 'Quota limit' })
  @IsNumber()
  quotaLimit: number;

  @ApiProperty({ example: 65.0, description: 'Percentage used' })
  @IsNumber()
  percentageUsed: number;

  @ApiProperty({ type: Object, required: false, description: 'Breakdown by operation' })
  @IsOptional()
  operationBreakdown?: Record<string, number>;

  @ApiProperty({ type: [TopConsumerDto], required: false, description: 'Top consumers for this day' })
  @IsOptional()
  topConsumers?: TopConsumerDto[];
}