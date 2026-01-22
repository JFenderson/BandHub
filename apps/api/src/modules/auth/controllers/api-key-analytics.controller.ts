/**
 * API Key Analytics Controller
 * 
 * Admin endpoints for viewing API key usage analytics
 */

import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { ApiKeyAnalyticsService } from '../services/api-key-analytics.service';
import { AdminRateLimit } from '../../../common/decorators/rate-limit.decorator';

@ApiTags('Admin - API Keys')
@Controller({ path: 'admin/api-keys', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
@AdminRateLimit()
export class ApiKeyAnalyticsController {
  constructor(private readonly analyticsService: ApiKeyAnalyticsService) {}

  @Get(':id/analytics')
  @ApiOperation({ 
    summary: 'Get API key usage analytics',
    description: 'Returns detailed usage statistics for a specific API key including request counts, endpoints accessed, response times, and trends.'
  })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  async getAnalytics(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const analytics = await this.analyticsService.getAnalytics(id, start, end);

    return {
      apiKeyId: id,
      dateRange: {
        start: start?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: end?.toISOString() || new Date().toISOString(),
      },
      analytics,
    };
  }

  @Get(':id/anomalies')
  @ApiOperation({ 
    summary: 'Detect usage anomalies',
    description: 'Detects unusual usage patterns and spikes for a specific API key.'
  })
  @ApiResponse({ status: 200, description: 'Anomalies detected' })
  async detectAnomalies(@Param('id') id: string) {
    const alerts = await this.analyticsService.detectAnomalies(id);

    return {
      apiKeyId: id,
      alertCount: alerts.length,
      alerts,
    };
  }

  @Get(':id/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Export usage report',
    description: 'Export API key usage data in CSV or JSON format.'
  })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'], description: 'Export format (default: csv)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  async exportReport(
    @Param('id') id: string,
    @Query('format') format?: 'csv' | 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const exportFormat = format || 'csv';

    const report = await this.analyticsService.exportUsageReport(id, exportFormat, start, end);

    return {
      format: exportFormat,
      content: report,
      generatedAt: new Date().toISOString(),
    };
  }
}
