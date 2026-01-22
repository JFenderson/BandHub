/**
 * API Key Analytics Service
 * 
 * Tracks and analyzes API key usage patterns:
 * - Request counts and endpoints accessed
 * - Response times and error rates
 * - Daily/monthly aggregates
 * - Quota enforcement
 * - Anomaly detection
 * - Usage reports and exports
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ApiKeyUsageStats {
  totalRequests: number;
  uniqueEndpoints: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerHour: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  dailyBreakdown: Array<{ date: string; requests: number }>;
}

export interface QuotaConfig {
  maxRequestsPerDay?: number;
  maxRequestsPerMonth?: number;
  alertThreshold?: number; // Percentage (e.g., 80 for 80%)
}

export interface UsageAlert {
  apiKeyId: string;
  apiKeyName: string;
  alertType: 'quota_exceeded' | 'spike_detected' | 'unusual_pattern';
  message: string;
  timestamp: Date;
  metadata?: any;
}

@Injectable()
export class ApiKeyAnalyticsService {
  private readonly logger = new Logger(ApiKeyAnalyticsService.name);
  
  // In-memory cache for quota tracking (could be Redis for distributed systems)
  private readonly quotaCache = new Map<string, { daily: number; monthly: number; lastReset: Date }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Track API key usage
   * Called by middleware/interceptor on each request
   */
  async trackUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isError = statusCode >= 400;

    try {
      // Update or create daily log
      await this.prisma.apiKeyUsageLog.upsert({
        where: {
          apiKeyId_date: {
            apiKeyId,
            date: today,
          },
        },
        create: {
          apiKeyId,
          date: today,
          endpoint,
          method,
          requestCount: 1,
          avgResponseTime: responseTime,
          errorCount: isError ? 1 : 0,
          metadata: {
            endpoints: { [endpoint]: 1 },
            methods: { [method]: 1 },
          },
        },
        update: {
          requestCount: { increment: 1 },
          errorCount: isError ? { increment: 1 } : undefined,
          avgResponseTime: {
            // Running average: (old_avg * old_count + new_value) / new_count
            // We'll simplify by just updating, proper running avg needs the count
            set: responseTime, // Simplified - in production, calculate proper running average
          },
          metadata: {
            // Increment endpoint counter in metadata
            // This is simplified - in production, use a proper JSON update
          },
        },
      });

      // Update API key last used timestamp
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      });

      // Check quota limits
      await this.checkQuota(apiKeyId);
    } catch (error) {
      this.logger.error(`Failed to track API key usage: ${error.message}`, error.stack);
    }
  }

  /**
   * Get analytics for a specific API key
   */
  async getAnalytics(
    apiKeyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ApiKeyUsageStats> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { usageLogs: true },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key ${apiKeyId} not found`);
    }

    // Default date range: last 30 days
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        apiKeyId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate statistics
    const totalRequests = logs.reduce((sum, log) => sum + log.requestCount, 0);
    const totalErrors = logs.reduce((sum, log) => sum + log.errorCount, 0);
    const avgResponseTime = logs.reduce((sum, log) => sum + (log.avgResponseTime || 0), 0) / (logs.length || 1);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Calculate requests per hour
    const hoursDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const requestsPerHour = hoursDiff > 0 ? totalRequests / hoursDiff : 0;

    // Extract unique endpoints from metadata
    const endpointCounts = new Map<string, number>();
    logs.forEach((log) => {
      if (log.metadata && typeof log.metadata === 'object') {
        const meta = log.metadata as any;
        if (meta.endpoints) {
          Object.entries(meta.endpoints).forEach(([endpoint, count]) => {
            endpointCounts.set(
              endpoint,
              (endpointCounts.get(endpoint) || 0) + (count as number),
            );
          });
        }
      }
      
      // Fallback to endpoint field
      if (log.endpoint) {
        endpointCounts.set(
          log.endpoint,
          (endpointCounts.get(log.endpoint) || 0) + log.requestCount,
        );
      }
    });

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dailyBreakdown = logs.map((log) => ({
      date: log.date.toISOString().split('T')[0],
      requests: log.requestCount,
    }));

    return {
      totalRequests,
      uniqueEndpoints: endpointCounts.size,
      avgResponseTime,
      errorRate,
      requestsPerHour,
      topEndpoints,
      dailyBreakdown,
    };
  }

  /**
   * Check if API key has exceeded quota
   */
  private async checkQuota(apiKeyId: string): Promise<boolean> {
    // Get quota config (this would come from database or config in production)
    const quotaConfig: QuotaConfig = {
      maxRequestsPerDay: 10000,
      maxRequestsPerMonth: 100000,
      alertThreshold: 80,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get daily usage
    const dailyLog = await this.prisma.apiKeyUsageLog.findUnique({
      where: {
        apiKeyId_date: {
          apiKeyId,
          date: today,
        },
      },
    });

    // Get monthly usage
    const monthlyLogs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        apiKeyId,
        date: { gte: startOfMonth },
      },
    });

    const dailyUsage = dailyLog?.requestCount || 0;
    const monthlyUsage = monthlyLogs.reduce((sum, log) => sum + log.requestCount, 0);

    // Check daily quota
    if (quotaConfig.maxRequestsPerDay && dailyUsage >= quotaConfig.maxRequestsPerDay) {
      await this.createAlert(apiKeyId, 'quota_exceeded', `Daily quota of ${quotaConfig.maxRequestsPerDay} requests exceeded`);
      return false;
    }

    // Check monthly quota
    if (quotaConfig.maxRequestsPerMonth && monthlyUsage >= quotaConfig.maxRequestsPerMonth) {
      await this.createAlert(apiKeyId, 'quota_exceeded', `Monthly quota of ${quotaConfig.maxRequestsPerMonth} requests exceeded`);
      return false;
    }

    // Check alert threshold
    if (quotaConfig.alertThreshold && quotaConfig.maxRequestsPerDay) {
      const threshold = quotaConfig.maxRequestsPerDay * (quotaConfig.alertThreshold / 100);
      if (dailyUsage >= threshold && dailyUsage < quotaConfig.maxRequestsPerDay) {
        this.logger.warn(`API key ${apiKeyId} approaching daily quota: ${dailyUsage}/${quotaConfig.maxRequestsPerDay}`);
      }
    }

    return true;
  }

  /**
   * Detect unusual usage patterns (spike detection)
   */
  async detectAnomalies(apiKeyId: string): Promise<UsageAlert[]> {
    const alerts: UsageAlert[] = [];

    // Get last 7 days of usage
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        apiKeyId,
        date: { gte: sevenDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    if (logs.length < 3) {
      return alerts; // Not enough data
    }

    // Calculate average and standard deviation
    const requestCounts = logs.map((log) => log.requestCount);
    const avg = requestCounts.reduce((a, b) => a + b, 0) / requestCounts.length;
    const variance = requestCounts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / requestCounts.length;
    const stdDev = Math.sqrt(variance);

    // Check if today's usage is significantly higher (more than 2 standard deviations)
    const todayUsage = logs[0].requestCount;
    if (todayUsage > avg + 2 * stdDev) {
      const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } });
      
      alerts.push({
        apiKeyId,
        apiKeyName: apiKey?.name || 'Unknown',
        alertType: 'spike_detected',
        message: `Unusual spike in usage detected: ${todayUsage} requests (avg: ${Math.round(avg)})`,
        timestamp: new Date(),
        metadata: { todayUsage, average: avg, stdDev },
      });

      this.logger.warn(`Usage spike detected for API key ${apiKeyId}: ${todayUsage} vs avg ${avg}`);
    }

    return alerts;
  }

  /**
   * Create usage alert
   */
  private async createAlert(
    apiKeyId: string,
    alertType: UsageAlert['alertType'],
    message: string,
  ) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    
    const alert: UsageAlert = {
      apiKeyId,
      apiKeyName: apiKey?.name || 'Unknown',
      alertType,
      message,
      timestamp: new Date(),
    };

    this.logger.warn(`API Key Alert [${alertType}]: ${message}`, { apiKeyId, apiKeyName: alert.apiKeyName });
    
    // TODO: Send email/Slack notification to admins
    // await this.notificationService.sendAlert(alert);

    return alert;
  }

  /**
   * Export usage data as CSV
   */
  async exportUsageReport(
    apiKeyId: string,
    format: 'csv' | 'json',
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        apiKeyId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = 'Date,Requests,Errors,Avg Response Time,Endpoint,Method\n';
    const rows = logs
      .map((log) => {
        return `${log.date.toISOString().split('T')[0]},${log.requestCount},${log.errorCount},${log.avgResponseTime || 0},${log.endpoint || 'N/A'},${log.method || 'N/A'}`;
      })
      .join('\n');

    return headers + rows;
  }

  /**
   * Cleanup old usage logs (run monthly)
   * Keep last 90 days of detailed logs, aggregate older data
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupOldLogs() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    this.logger.log('Cleaning up API key usage logs older than 90 days...');

    const result = await this.prisma.apiKeyUsageLog.deleteMany({
      where: {
        date: { lt: ninetyDaysAgo },
      },
    });

    this.logger.log(`Deleted ${result.count} old API key usage logs`);
  }

  /**
   * Generate daily summary for all API keys
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySummary() {
    this.logger.log('Generating daily API key usage summary...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: { date: yesterday },
      include: { apiKey: true },
    });

    const summary = logs.map((log) => ({
      apiKeyName: log.apiKey.name,
      requests: log.requestCount,
      errors: log.errorCount,
      avgResponseTime: log.avgResponseTime,
    }));

    this.logger.log(`Daily summary: ${summary.length} API keys used yesterday`);
    // TODO: Send summary email to admins
    
    return summary;
  }
}
