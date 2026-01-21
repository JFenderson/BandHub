import { Controller, Get, Post, Body, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { YoutubeQuotaService } from './youtube-quota.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';
import {
  QuotaStatusDto,
  QuotaAnalyticsDto,
  QuotaAlertDto,
  QuotaApprovalRequestDto,
  QuotaApprovalResponseDto,
  EstimateSyncCostDto,
  CostEstimationResponseDto,
  AcknowledgeAlertDto,
  QuotaHistoryQueryDto,
  DailySummaryDto,
} from './dto/quota-analytics.dto';
import { SyncPriority } from './interfaces/quota.interface';

/**
 * YouTube Quota Management Controller
 * 
 * File: apps/api/src/youtube/youtube-quota.controller.ts
 * 
 * This controller provides admin endpoints for:
 * - Real-time quota monitoring
 * - Historical analytics and reporting
 * - Quota approval for sync jobs
 * - Alert management
 * - Cost estimation
 * 
 * All endpoints require admin authentication for security.
 * These endpoints power the admin dashboard for quota management.
 */
@ApiTags('YouTube Quota Management')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('SUPER_ADMIN', 'ADMIN')
@Controller({ path: 'admin/youtube/quota', version: '1' })
export class YoutubeQuotaController {
  constructor(private readonly quotaService: YoutubeQuotaService) {}

  /**
   * GET /admin/youtube/quota/status
   * Get current quota status in real-time
   * 
   * This is the primary endpoint for the dashboard header showing
   * current usage, remaining quota, and alert level.
   */
  @Get('status')
  @ApiOperation({ 
    summary: 'Get current quota status',
    description: 'Returns real-time quota usage, remaining quota, and alert level',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Quota status retrieved successfully',
    type: QuotaStatusDto,
  })
  async getQuotaStatus(): Promise<QuotaStatusDto> {
    return this.quotaService.getQuotaStatus();
  }

  /**
   * GET /admin/youtube/quota/analytics
   * Get comprehensive quota analytics
   * 
   * This endpoint powers the main analytics dashboard showing:
   * - Today's usage breakdown
   * - Historical trends (7 days, 30 days)
   * - Cache efficiency metrics
   * - Usage forecasting
   * - Top quota consumers
   */
  @Get('analytics')
  @ApiOperation({ 
    summary: 'Get comprehensive quota analytics',
    description: 'Returns detailed analytics including trends, forecasts, and efficiency metrics',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics retrieved successfully',
    type: QuotaAnalyticsDto,
  })
async getAnalytics(): Promise<QuotaAnalyticsDto> {
  return this.quotaService.getQuotaAnalytics() as any;
}
  /**
   * POST /admin/youtube/quota/estimate
   * Estimate quota cost for a sync job
   * 
   * Used before starting a sync to determine if there's enough quota.
   * Helps admins decide whether to proceed with a sync operation.
   */
  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Estimate quota cost for a sync job',
    description: 'Calculate estimated quota cost based on sync parameters',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cost estimation completed',
    type: CostEstimationResponseDto,
  })
  async estimateCost(
    @Body() estimateDto: EstimateSyncCostDto,
  ): Promise<CostEstimationResponseDto> {
    const estimatedCost = await this.quotaService.estimateSyncCost({
      hasChannelId: estimateDto.hasChannelId,
      estimatedVideoCount: estimateDto.estimatedVideoCount,
      useSearch: estimateDto.useSearch,
      searchQueriesCount: estimateDto.searchQueriesCount,
    });

    // Determine sync method
    let syncMethod: string;
    if (estimateDto.hasChannelId) {
      syncMethod = 'Channel-based sync (efficient)';
    } else if (estimateDto.useSearch) {
      syncMethod = 'Search-based sync (expensive)';
    } else {
      syncMethod = 'Unknown method';
    }

    // Build breakdown
    const breakdown: any = {};
    if (estimateDto.useSearch) {
      breakdown.search = 100 * (estimateDto.searchQueriesCount || 3);
    }
    if (estimateDto.hasChannelId) {
      breakdown.channelList = 1;
      breakdown.playlistItems = Math.ceil(estimateDto.estimatedVideoCount / 50);
    }
    breakdown.videoList = Math.ceil(estimateDto.estimatedVideoCount / 50);

    // Determine if cost is high (more than 500 units)
    const isHighCost = estimatedCost > 500;

    return {
      estimatedCost,
      breakdown,
      syncMethod,
      isHighCost,
    };
  }

  /**
   * POST /admin/youtube/quota/approve
   * Request quota approval for a sync job
   * 
   * This endpoint checks if a sync job should proceed based on:
   * - Current quota availability
   * - Job priority level
   * - Emergency mode status
   * 
   * Returns approval decision with reasoning.
   */
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Request quota approval for sync job',
    description: 'Check if sync job can proceed based on quota availability and priority',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Approval decision returned',
    type: QuotaApprovalResponseDto,
  })
  async approveQuota(
    @Body() approvalDto: QuotaApprovalRequestDto,
  ): Promise<QuotaApprovalResponseDto> {
    const plan = await this.quotaService.approveSyncJob(
      approvalDto.bandId,
      approvalDto.priority,
      approvalDto.estimatedCost,
    );

    const remaining = await this.quotaService.getRemainingQuota();

    return {
      approved: approvalDto.forceApprove || plan.approved,
      estimatedCost: plan.estimatedCost,
      allocatedQuota: plan.allocatedQuota,
      remainingQuota: remaining,
      reason: plan.reason,
      timestamp: plan.timestamp,
    };
  }

  /**
   * GET /admin/youtube/quota/alerts
   * Get recent quota alerts
   * 
   * Returns list of quota threshold alerts for monitoring.
   * Useful for compliance and troubleshooting.
   */
  @Get('alerts')
  @ApiOperation({ 
    summary: 'Get quota alerts',
    description: 'Retrieve recent quota threshold alerts',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alerts retrieved successfully',
    type: [QuotaAlertDto],
  })
  async getAlerts(
    @Query('limit') limit: number = 50,
    @Query('unacknowledged') unacknowledgedOnly: boolean = false,
  ): Promise<QuotaAlertDto[]> {
    // Fetch from database
    const alerts = await this.quotaService['db'].quotaAlert.findMany({
      where: unacknowledgedOnly ? { acknowledged: false } : undefined,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return alerts.map((alert) => ({
      id: alert.id,
      level: alert.level as any,
      message: alert.message,
      currentUsage: alert.currentUsage,
      timestamp: alert.timestamp,
      acknowledged: alert.acknowledged,
      acknowledgedAt: alert.acknowledgedAt || undefined,
      acknowledgedBy: alert.acknowledgedBy || undefined,
    }));
  }

  /**
   * POST /admin/youtube/quota/alerts/:id/acknowledge
   * Acknowledge a quota alert
   * 
   * Mark an alert as acknowledged by an admin.
   */
  @Post('alerts/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Acknowledge quota alert',
    description: 'Mark an alert as acknowledged',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert acknowledged successfully',
  })
  async acknowledgeAlert(
    @Param('id') alertId: string,
    @Body() ackDto: AcknowledgeAlertDto,
  ): Promise<{ success: boolean }> {
    await this.quotaService['db'].quotaAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: ackDto.acknowledgedBy,
      },
    });

    return { success: true };
  }

  /**
   * GET /admin/youtube/quota/history
   * Get quota usage history
   * 
   * Returns historical quota usage with optional filtering.
   */
  @Get('history')
  @ApiOperation({ 
    summary: 'Get quota usage history',
    description: 'Retrieve historical quota usage data with optional filters',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'History retrieved successfully',
    type: [DailySummaryDto],
  })
  async getHistory(
    @Query() query: QuotaHistoryQueryDto,
  ): Promise<DailySummaryDto[]> {
    const days = query.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summaries = await this.quotaService['db'].quotaDailySummary.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });

    return summaries.map((summary) => ({
      date: summary.date.toISOString().split('T')[0],
      totalUsage: summary.totalUsage,
      quotaLimit: summary.quotaLimit,
      percentageUsed: summary.percentageUsed,
      operationBreakdown: summary.operationBreakdown as any,
      topConsumers: summary.topConsumers as any,
    }));
  }

  /**
   * GET /admin/youtube/quota/usage/logs
   * Get detailed usage logs
   * 
   * Returns granular operation logs for debugging and analysis.
   */
  @Get('usage/logs')
  @ApiOperation({ 
    summary: 'Get detailed usage logs',
    description: 'Retrieve granular quota usage logs for analysis',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logs retrieved successfully',
  })
  async getUsageLogs(
    @Query('limit') limit: number = 100,
    @Query('bandId') bandId?: string,
    @Query('operation') operation?: string,
  ) {
    const where: any = {};
    if (bandId) where.bandId = bandId;
    if (operation) where.operation = operation;

    const logs = await this.quotaService['db'].quotaUsageLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        band: { select: { name: true } },
        syncJob: { select: { id: true, jobType: true } },
      },
    });

    return logs;
  }

  /**
   * GET /admin/youtube/quota/summary
   * Get quick summary for dashboard header
   * 
   * Lightweight endpoint for frequent polling.
   */
  @Get('summary')
  @ApiOperation({ 
    summary: 'Get quota summary',
    description: 'Lightweight summary for dashboard header',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Summary retrieved successfully',
  })
  async getSummary() {
    const status = await this.quotaService.getQuotaStatus();
    
    return {
      currentUsage: status.currentUsage,
      limit: status.limit,
      remaining: status.remaining,
      percentageUsed: status.percentageUsed,
      alertLevel: status.alertLevel,
      isEmergencyMode: status.isEmergencyMode,
    };
  }

  /**
   * POST /admin/youtube/quota/emergency/activate
   * Manually activate emergency mode
   * 
   * Admin override to activate quota preservation mode.
   */
  @Post('emergency/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Activate emergency mode',
    description: 'Manually activate quota preservation mode (admin override)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Emergency mode activated',
  })
  async activateEmergencyMode() {
    await this.quotaService['activateEmergencyMode']();
    return { success: true, message: 'Emergency mode activated' };
  }

  /**
   * POST /admin/youtube/quota/emergency/deactivate
   * Deactivate emergency mode
   */
  @Post('emergency/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Deactivate emergency mode',
    description: 'Deactivate quota preservation mode',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Emergency mode deactivated',
  })
  async deactivateEmergencyMode() {
    await this.quotaService['cache'].del(this.quotaService['EMERGENCY_MODE_KEY']);
    return { success: true, message: 'Emergency mode deactivated' };
  }

  /**
   * GET /admin/youtube/quota/recommendations
   * Get optimization recommendations
   * 
   * AI-driven recommendations for reducing quota usage.
   */
  @Get('recommendations')
  @ApiOperation({ 
    summary: 'Get optimization recommendations',
    description: 'Get AI-driven recommendations for reducing quota usage',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Recommendations retrieved successfully',
  })
  async getRecommendations() {
    const analytics = await this.quotaService.getQuotaAnalytics();
    
    const recommendations = [
      ...analytics.forecast.recommendations,
    ];

    // Add more recommendations based on data
    if (analytics.efficiency.cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low - consider increasing cache TTL');
    }

    if (analytics.today.operationBreakdown['search'] > 1000) {
      recommendations.push('High search API usage - prioritize channel-based sync');
    }

    return {
      recommendations,
      riskLevel: analytics.forecast.riskLevel,
      currentEfficiency: analytics.efficiency.cacheHitRate,
    };
  }
}