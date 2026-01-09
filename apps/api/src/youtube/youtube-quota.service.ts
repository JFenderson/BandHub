import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService} from '@bandhub/database';
import { CacheService } from '@bandhub/cache';
import {
  YouTubeOperation,
  QUOTA_COSTS,
  DAILY_QUOTA_LIMIT,
  QuotaAlertLevel,
  QUOTA_ALERT_THRESHOLDS,
  SyncPriority,
  PRIORITY_QUOTA_ALLOCATION,
  EMERGENCY_MODE_THRESHOLD,
  QuotaUsageRecord,
  QuotaStatus,
  QuotaAnalytics,
  QuotaAllocationPlan,
  QuotaAlert,
  QuotaConfig,
} from './interfaces/quota.interface';

/**
 * YouTube Quota Management Service
 * 
 * File: apps/api/src/youtube/youtube-quota.service.ts
 * 
 * This service provides comprehensive YouTube API quota management including:
 * - Real-time quota tracking with Redis caching
 * - Intelligent quota distribution based on priority
 * - Quota overflow protection and emergency mode
 * - Historical analytics and forecasting
 * - Alert system for quota thresholds
 * - Per-operation cost calculation
 * - Cache-aware quota optimization
 * 
 * Architecture:
 * - Uses Redis for real-time quota counters (fast reads/writes)
 * - Persists detailed logs to PostgreSQL (historical analysis)
 * - Integrates with CacheService to track quota savings
 * - Coordinates with SyncScheduler for intelligent job distribution
 * 
 * Why this approach:
 * 1. Redis provides sub-millisecond quota checks (critical for high-throughput)
 * 2. PostgreSQL stores detailed logs for analytics and compliance
 * 3. Separation of concerns: tracking vs analysis
 * 4. Scalable: Can handle 1000s of operations per day
 */
@Injectable()
export class YoutubeQuotaService implements OnModuleInit {
  private readonly logger = new Logger(YoutubeQuotaService.name);
  
  // Redis cache keys
  private readonly QUOTA_KEY = 'youtube:quota:daily';
  private readonly QUOTA_OPERATIONS_KEY = 'youtube:quota:operations';
  private readonly EMERGENCY_MODE_KEY = 'youtube:quota:emergency';
  private readonly ALERT_KEY = 'youtube:quota:alerts';
  
  // Configuration
  private config: QuotaConfig;
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {
    // Initialize configuration from environment
    this.config = {
      dailyLimit: this.configService.get<number>('YOUTUBE_QUOTA_LIMIT') || DAILY_QUOTA_LIMIT,
      emergencyThreshold: EMERGENCY_MODE_THRESHOLD,
      alertThresholds: QUOTA_ALERT_THRESHOLDS,
      priorityAllocation: PRIORITY_QUOTA_ALLOCATION,
      enableEmergencyMode: true,
      enableAlerts: true,
      cacheStrategy: 'aggressive', // Aggressive caching to save quota
    };
  }

  /**
   * Initialize quota tracking on module startup
   */
  async onModuleInit() {
    await this.initializeQuotaTracking();
    this.logger.log('YouTube Quota Service initialized');
  }

  /**
   * Initialize or restore quota tracking from cache/database
   */
  private async initializeQuotaTracking() {
    // Check if quota needs reset (new day)
    const lastReset = await this.cache.get<string>('youtube:quota:last_reset');
    const now = new Date();
    const today = this.getDateKey(now);

    if (!lastReset || lastReset !== today) {
      this.logger.log('New day detected - resetting quota counter');
      await this.resetDailyQuota();
    } else {
      // Restore current usage from cache
      const currentUsage = await this.getCurrentUsage();
      this.logger.log(`Quota tracking restored - Current usage: ${currentUsage}/${this.config.dailyLimit}`);
    }
  }

  /**
   * Reset daily quota counter (called at midnight Pacific)
   */
  private async resetDailyQuota() {
    const today = this.getDateKey(new Date());
    
    // Archive yesterday's data
    const yesterdayUsage = await this.getCurrentUsage();
    if (yesterdayUsage > 0) {
      await this.archiveDailySummary(yesterdayUsage);
    }
    
    // Reset counters
    await this.cache.set(this.QUOTA_KEY, '0');
    await this.cache.set('youtube:quota:last_reset', today);
    await this.cache.del(this.EMERGENCY_MODE_KEY);
    
    this.logger.log('Daily quota counter reset successfully');
  }

  /**
   * Get current quota usage from cache (fast, real-time)
   */
  async getCurrentUsage(): Promise<number> {
    const usage = await this.cache.get<string>(this.QUOTA_KEY);
    return parseInt(usage || '0', 10);
  }

  /**
   * Get remaining quota
   */
  async getRemainingQuota(): Promise<number> {
    const used = await this.getCurrentUsage();
    return Math.max(0, this.config.dailyLimit - used);
  }

  /**
   * Get current quota status
   */
  async getQuotaStatus(): Promise<QuotaStatus> {
    const currentUsage = await this.getCurrentUsage();
    const remaining = this.config.dailyLimit - currentUsage;
    const percentageUsed = (currentUsage / this.config.dailyLimit) * 100;
    
    return {
      currentUsage,
      limit: this.config.dailyLimit,
      remaining,
      percentageUsed,
      alertLevel: this.determineAlertLevel(percentageUsed / 100),
      resetTime: this.getNextResetTime(),
      isEmergencyMode: await this.isEmergencyMode(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if quota is available for an operation
   */
  async checkQuotaAvailable(
    operation: YouTubeOperation,
    count: number = 1,
  ): Promise<{ available: boolean; reason?: string }> {
    const cost = QUOTA_COSTS[operation] * count;
    const remaining = await this.getRemainingQuota();
    
    // Check emergency mode
    if (await this.isEmergencyMode()) {
      return {
        available: false,
        reason: 'Emergency quota preservation mode is active',
      };
    }
    
    // Check if quota is available
    if (remaining < cost) {
      return {
        available: false,
        reason: `Insufficient quota. Required: ${cost}, Available: ${remaining}`,
      };
    }
    
    return { available: true };
  }

  /**
   * Reserve quota for an operation (before making API call)
   * This prevents race conditions in concurrent operations
   */
  async reserveQuota(
    operation: YouTubeOperation,
    count: number = 1,
    metadata?: { bandId?: string; syncJobId?: string },
  ): Promise<{ reserved: boolean; reservationId?: string; reason?: string }> {
    const cost = QUOTA_COSTS[operation] * count;
    
    // Check availability
    const check = await this.checkQuotaAvailable(operation, count);
    if (!check.available) {
      return {
        reserved: false,
        reason: check.reason,
      };
    }
    
    // Reserve quota atomically
    const reservationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Increment usage
    await this.incrementUsage(cost);
    
    this.logger.debug(
      `Quota reserved: ${operation} x${count} = ${cost} units (Reservation: ${reservationId})`,
    );
    
    return {
      reserved: true,
      reservationId,
    };
  }

  /**
   * Track successful API operation
   */
  async trackOperation(
    operation: YouTubeOperation,
    success: boolean,
    options: {
      bandId?: string;
      bandName?: string;
      syncJobId?: string;
      cacheHit?: boolean;
      errorMessage?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    const cost = options.cacheHit ? 0 : QUOTA_COSTS[operation];
    
    // Create usage record
    const record: QuotaUsageRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      cost,
      timestamp: new Date(),
      bandId: options.bandId,
      bandName: options.bandName,
      syncJobId: options.syncJobId,
      success,
      cacheHit: options.cacheHit || false,
      errorMessage: options.errorMessage,
      metadata: options.metadata,
    };
    
    // Persist to database (async, non-blocking)
    this.persistUsageRecord(record).catch((error) => {
      this.logger.error('Failed to persist quota usage record:', error);
    });
    
    // Update real-time counters if not from cache
    if (!options.cacheHit && success) {
      await this.incrementUsage(cost);
      
      // Check for alerts
      await this.checkAndTriggerAlerts();
    }
    
    this.logger.debug(
      `Operation tracked: ${operation} (${cost} units, cache hit: ${options.cacheHit})`,
    );
  }

  /**
   * Increment quota usage atomically
   */
  private async incrementUsage(cost: number): Promise<void> {
    const client = this.cache.getClient();
    await client.incrby(this.QUOTA_KEY, cost);
  }

  /**
   * Calculate estimated cost for a sync job
   */
  async estimateSyncCost(options: {
    hasChannelId: boolean;
    estimatedVideoCount: number;
    useSearch: boolean;
    searchQueriesCount?: number;
  }): Promise<number> {
    let totalCost = 0;
    
    if (options.useSearch) {
      // Search-based sync (expensive)
      const searches = options.searchQueriesCount || 3;
      totalCost += QUOTA_COSTS[YouTubeOperation.SEARCH] * searches;
    }
    
    if (options.hasChannelId) {
      // Channel-based sync (efficient)
      totalCost += QUOTA_COSTS[YouTubeOperation.CHANNEL_LIST]; // Get playlist ID
      
      // Playlist items requests (50 videos per page)
      const playlistPages = Math.ceil(options.estimatedVideoCount / 50);
      totalCost += QUOTA_COSTS[YouTubeOperation.PLAYLIST_ITEMS_LIST] * playlistPages;
    }
    
    // Video details enrichment (batched, 50 per request)
    const videoDetailRequests = Math.ceil(options.estimatedVideoCount / 50);
    totalCost += QUOTA_COSTS[YouTubeOperation.VIDEO_LIST] * videoDetailRequests;
    
    return totalCost;
  }

  /**
   * Check if a sync job should be approved based on quota and priority
   */
  async approveSyncJob(
    bandId: string,
    priority: SyncPriority,
    estimatedCost: number,
  ): Promise<QuotaAllocationPlan> {
    const remaining = await this.getRemainingQuota();
    const allocatedQuota = remaining * PRIORITY_QUOTA_ALLOCATION[priority];
    
    const plan: QuotaAllocationPlan = {
      jobId: `${Date.now()}-${bandId}`,
      bandId,
      priority,
      estimatedCost,
      allocatedQuota,
      approved: false,
      timestamp: new Date(),
    };
    
    // Check emergency mode
    if (await this.isEmergencyMode()) {
      plan.approved = false;
      plan.reason = 'Emergency quota preservation mode active';
      return plan;
    }
    
    // Check if estimated cost fits within allocation
    if (estimatedCost <= allocatedQuota) {
      plan.approved = true;
    } else if (priority === SyncPriority.CRITICAL && estimatedCost <= remaining) {
      // Allow critical jobs to exceed allocation if total quota available
      plan.approved = true;
      plan.reason = 'Critical priority override';
    } else {
      plan.approved = false;
      plan.reason = `Estimated cost (${estimatedCost}) exceeds allocated quota (${allocatedQuota})`;
    }
    
    return plan;
  }

  /**
   * Get comprehensive quota analytics
   */
  async getQuotaAnalytics(): Promise<QuotaAnalytics> {
    const today = this.getDateKey(new Date());
    const currentUsage = await this.getCurrentUsage();
    
    // Fetch operation breakdown
    const operationBreakdown = await this.getOperationBreakdown(today);
    
    // Fetch top consumers
    const topConsumers = await this.getTopConsumers(today, 10);
    
    // Historical data
    const last7DaysData = await this.getHistoricalData(7);
    const last30DaysData = await this.getHistoricalData(30);
    
    // Cache efficiency
    const cacheStats = await this.getCacheEfficiencyStats();
    
    // Build analytics
    const analytics: QuotaAnalytics = {
      today: {
        used: currentUsage,
        remaining: this.config.dailyLimit - currentUsage,
        percentageUsed: (currentUsage / this.config.dailyLimit) * 100,
        operationBreakdown,
        topConsumers,
      },
      last7Days: {
        averageDaily: last7DaysData.average,
        peakDaily: last7DaysData.peak,
        totalUsed: last7DaysData.total,
        trend: last7DaysData.trend,
      },
      last30Days: {
        averageDaily: last30DaysData.average,
        peakDaily: last30DaysData.peak,
        totalUsed: last30DaysData.total,
        trend: last30DaysData.trend,
      },
      efficiency: {
        cacheHitRate: cacheStats.hitRate,
        quotaSavedByCache: cacheStats.quotaSaved,
        averageCostPerSync: await this.getAverageCostPerSync(),
        mostExpensiveOperations: await this.getMostExpensiveOperations(),
      },
      forecast: await this.generateForecast(last30DaysData.average),
    };
    
    return analytics;
  }

  /**
   * Determine alert level based on usage percentage
   */
  private determineAlertLevel(usagePercentage: number): QuotaAlertLevel {
    if (usagePercentage >= this.config.alertThresholds[QuotaAlertLevel.DEPLETED]) {
      return QuotaAlertLevel.DEPLETED;
    } else if (usagePercentage >= this.config.alertThresholds[QuotaAlertLevel.CRITICAL]) {
      return QuotaAlertLevel.CRITICAL;
    } else if (usagePercentage >= this.config.alertThresholds[QuotaAlertLevel.WARNING]) {
      return QuotaAlertLevel.WARNING;
    }
    return QuotaAlertLevel.INFO;
  }

  /**
   * Check if emergency mode should be activated
   */
  private async isEmergencyMode(): Promise<boolean> {
    const isActive = await this.cache.get<boolean>(this.EMERGENCY_MODE_KEY);
    return isActive === true;
  }

  /**
   * Activate emergency quota preservation mode
   */
  private async activateEmergencyMode() {
    await this.cache.set(this.EMERGENCY_MODE_KEY, true, 86400); // 24 hours
    
    const alert: QuotaAlert = {
      id: `alert-${Date.now()}`,
      level: QuotaAlertLevel.DEPLETED,
      message: 'Emergency quota preservation mode activated',
      currentUsage: await this.getCurrentUsage(),
      timestamp: new Date(),
      acknowledged: false,
    };
    
    await this.saveAlert(alert);
    
    this.logger.error('🚨 EMERGENCY MODE ACTIVATED - Quota preservation in effect');
  }

  /**
   * Check quota thresholds and trigger alerts
   */
  private async checkAndTriggerAlerts() {
    const status = await this.getQuotaStatus();
    const usagePercentage = status.percentageUsed / 100;
    
    // Check emergency mode threshold
    if (usagePercentage >= this.config.emergencyThreshold && this.config.enableEmergencyMode) {
      await this.activateEmergencyMode();
    }
    
    // Check alert thresholds
    if (this.config.enableAlerts) {
      const level = status.alertLevel;
      
      if (level !== QuotaAlertLevel.INFO) {
        const alert: QuotaAlert = {
          id: `alert-${Date.now()}`,
          level,
          message: `Quota usage at ${status.percentageUsed.toFixed(1)}% (${status.currentUsage}/${status.limit})`,
          currentUsage: status.currentUsage,
          timestamp: new Date(),
          acknowledged: false,
        };
        
        await this.saveAlert(alert);
        
        this.logger.warn(`⚠️  Quota Alert [${level}]: ${alert.message}`);
      }
    }
  }

  /**
   * Get next quota reset time (midnight Pacific)
   */
  private getNextResetTime(): Date {
    const now = new Date();
    const resetTime = new Date(now);
    
    // Set to midnight Pacific (UTC-8 or UTC-7 depending on DST)
    resetTime.setUTCHours(8, 0, 0, 0); // Midnight Pacific in UTC
    
    // If we've passed today's reset, move to tomorrow
    if (now.getTime() >= resetTime.getTime()) {
      resetTime.setDate(resetTime.getDate() + 1);
    }
    
    return resetTime;
  }

  /**
   * Get date key for tracking (YYYY-MM-DD)
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Cron job: Reset quota at midnight Pacific
   */
  @Cron('0 8 * * *', { name: 'quota-reset', timeZone: 'UTC' })
  async scheduledQuotaReset() {
    this.logger.log('Scheduled quota reset triggered');
    await this.resetDailyQuota();
  }

  /**
   * Cron job: Generate daily analytics report
   */
  @Cron('0 9 * * *', { name: 'daily-analytics', timeZone: 'UTC' })
  async generateDailyAnalytics() {
    try {
      const analytics = await this.getQuotaAnalytics();
      
      this.logger.log('='.repeat(60));
      this.logger.log('📊 DAILY QUOTA ANALYTICS REPORT');
      this.logger.log('='.repeat(60));
      this.logger.log(`Yesterday: ${analytics.today.used}/${this.config.dailyLimit} units (${analytics.today.percentageUsed.toFixed(1)}%)`);
      this.logger.log(`7-day average: ${analytics.last7Days.averageDaily.toFixed(0)} units/day`);
      this.logger.log(`Cache hit rate: ${(analytics.efficiency.cacheHitRate * 100).toFixed(1)}%`);
      this.logger.log(`Quota saved by cache: ${analytics.efficiency.quotaSavedByCache} units`);
      this.logger.log('='.repeat(60));
    } catch (error) {
      this.logger.error('Failed to generate daily analytics:', error);
    }
  }

  // ========== DATABASE PERSISTENCE METHODS ==========

  /**
   * Persist usage record to database
   */
  private async persistUsageRecord(record: QuotaUsageRecord): Promise<void> {
    await this.prisma.quotaUsageLog.create({
      data: {
        id: record.id,
        operation: record.operation,
        cost: record.cost,
        timestamp: record.timestamp,
        bandId: record.bandId,
        bandName: record.bandName,
        syncJobId: record.syncJobId,
        success: record.success,
        cacheHit: record.cacheHit,
        errorMessage: record.errorMessage,
        metadata: record.metadata as any,
      },
    });
  }

  /**
   * Archive daily summary to database
   */
  private async archiveDailySummary(totalUsage: number): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = this.getDateKey(yesterday);
    
    await this.prisma.quotaDailySummary.create({
      data: {
        date: new Date(dateKey),
        totalUsage,
        quotaLimit: this.config.dailyLimit,
        percentageUsed: (totalUsage / this.config.dailyLimit) * 100,
      },
    });
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: QuotaAlert): Promise<void> {
    await this.prisma.quotaAlert.create({
      data: {
        id: alert.id,
        level: alert.level,
        message: alert.message,
        currentUsage: alert.currentUsage,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
      },
    });
  }

  /**
   * Get operation breakdown for a date
   */
  private async getOperationBreakdown(dateKey: string): Promise<Record<YouTubeOperation, number>> {
    const records = await this.prisma.quotaUsageLog.groupBy({
      by: ['operation'],
      where: {
        timestamp: {
          gte: new Date(dateKey),
          lt: new Date(new Date(dateKey).getTime() + 86400000),
        },
        success: true,
      },
      _sum: {
        cost: true,
      },
    });
    
    const breakdown: Record<string, number> = {};
    records.forEach((record) => {
      breakdown[record.operation] = record._sum.cost || 0;
    });
    
    return breakdown as Record<YouTubeOperation, number>;
  }

  /**
   * Get top quota consumers
   */
private async getTopConsumers(dateKey: string, limit: number) {
  const records = await this.prisma.quotaUsageLog.groupBy({
    by: ['bandId', 'bandName'],
    where: {
      timestamp: {
        gte: new Date(dateKey),
        lt: new Date(new Date(dateKey).getTime() + 86400000),
      },
      success: true,
      bandId: { not: null },
    },
    _sum: {
      cost: true,
    },
    orderBy: {
      _sum: {
        cost: 'desc',
      },
    },
    take: limit,
  });
  
  // Calculate total usage for percentage calculation
  const totalUsage = records.reduce((sum, r) => sum + (r._sum.cost || 0), 0);
  
  return records.map((record) => ({
    bandId: record.bandId!,
    bandName: record.bandName || 'Unknown',
    quotaUsed: record._sum.cost || 0,
    percentageOfTotal: totalUsage > 0 ? ((record._sum.cost || 0) / totalUsage) * 100 : 0,
  }));
}

  /**
   * Get historical data for N days
   */
  private async getHistoricalData(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const summaries = await this.prisma.quotaDailySummary.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });
    
    const total = summaries.reduce((sum, s) => sum + s.totalUsage, 0);
    const average = summaries.length > 0 ? total / summaries.length : 0;
    const peak = Math.max(...summaries.map((s) => s.totalUsage), 0);
    
    // Calculate trend
    const firstHalf = summaries.slice(0, Math.floor(summaries.length / 2));
    const secondHalf = summaries.slice(Math.floor(summaries.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.totalUsage, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.totalUsage, 0) / secondHalf.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (secondAvg > firstAvg * 1.1) {
      trend = 'increasing';
    } else if (secondAvg < firstAvg * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
    
    return { average, peak, total, trend };
  }

  /**
   * Get cache efficiency statistics
   */
  private async getCacheEfficiencyStats() {
    const today = this.getDateKey(new Date());
    
    const stats = await this.prisma.quotaUsageLog.aggregate({
      where: {
        timestamp: {
          gte: new Date(today),
          lt: new Date(new Date(today).getTime() + 86400000),
        },
      },
      _count: { id: true },
      _sum: { cost: true },
    });
    
    const cacheHits = await this.prisma.quotaUsageLog.count({
      where: {
        timestamp: {
          gte: new Date(today),
          lt: new Date(new Date(today).getTime() + 86400000),
        },
        cacheHit: true,
      },
    });
    
    const totalRequests = stats._count.id || 0;
    const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
    
    // Estimate quota saved by cache (cache hits would have cost quota)
    const quotaSaved = cacheHits * 1; // Approximate average cost per request
    
    return { hitRate, quotaSaved };
  }

  /**
   * Get average cost per sync job
   */
  private async getAverageCostPerSync(): Promise<number> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const stats = await this.prisma.quotaUsageLog.groupBy({
      by: ['syncJobId'],
      where: {
        timestamp: { gte: last30Days },
        syncJobId: { not: null },
      },
      _sum: { cost: true },
    });
    
    if (stats.length === 0) return 0;
    
    const totalCost = stats.reduce((sum, s) => sum + (s._sum.cost || 0), 0);
    return totalCost / stats.length;
  }

  /**
   * Get most expensive operations
   */
  private async getMostExpensiveOperations() {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const stats = await this.prisma.quotaUsageLog.groupBy({
      by: ['operation'],
      where: {
        timestamp: { gte: last30Days },
        success: true,
      },
      _count: { id: true },
      _sum: { cost: true },
      orderBy: {
        _sum: {
          cost: 'desc',
        },
      },
      take: 5,
    });
    
    return stats.map((s) => ({
      operation: s.operation as YouTubeOperation,
      count: s._count.id,
      totalCost: s._sum.cost || 0,
    }));
  }

  /**
   * Generate usage forecast
   */
  private async generateForecast(averageDaily: number) {
    const estimatedDailyUsage = Math.round(averageDaily);
    const projectedMonthlyUsage = Math.round(averageDaily * 30);
    
    let riskLevel: 'low' | 'medium' | 'high';
    if (averageDaily < this.config.dailyLimit * 0.5) {
      riskLevel = 'low';
    } else if (averageDaily < this.config.dailyLimit * 0.75) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }
    
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Consider reducing sync frequency');
      recommendations.push('Increase cache TTL to reduce API calls');
      recommendations.push('Prioritize official channels over search-based sync');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor usage closely during peak hours');
      recommendations.push('Review search query efficiency');
    }
    
    return {
      estimatedDailyUsage,
      projectedMonthlyUsage,
      riskLevel,
      recommendations,
    };
  }
}