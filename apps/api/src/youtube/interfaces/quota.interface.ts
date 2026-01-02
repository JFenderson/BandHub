/**
 * YouTube Quota Management - Type Definitions and Interfaces
 * 
 * File: apps/api/src/youtube/interfaces/quota.interface.ts
 * 
 * This file defines all types, interfaces, and constants used for YouTube API quota management.
 * It provides comprehensive type safety for quota tracking, analytics, and optimization.
 */

/**
 * YouTube API operation types with their associated quota costs
 * Based on official YouTube API v3 quota documentation
 * @see https://developers.google.com/youtube/v3/determine_quota_cost
 */
export enum YouTubeOperation {
  // Search operations (most expensive)
  SEARCH = 'search',
  
  // Video operations
  VIDEO_LIST = 'video.list',
  VIDEO_INSERT = 'video.insert',
  VIDEO_UPDATE = 'video.update',
  VIDEO_RATE = 'video.rate',
  
  // Channel operations
  CHANNEL_LIST = 'channel.list',
  
  // Playlist operations
  PLAYLIST_ITEMS_LIST = 'playlistItems.list',
  PLAYLIST_LIST = 'playlist.list',
  
  // Comment operations
  COMMENT_THREADS_LIST = 'commentThreads.list',
  COMMENT_INSERT = 'comment.insert',
  
  // Other operations
  ACTIVITIES_LIST = 'activities.list',
  SUBSCRIPTIONS_LIST = 'subscriptions.list',
}

/**
 * Quota cost for each operation type
 * These values are defined by YouTube's API quota system
 */
export const QUOTA_COSTS: Record<YouTubeOperation, number> = {
  [YouTubeOperation.SEARCH]: 100,                    // Search is VERY expensive
  [YouTubeOperation.VIDEO_LIST]: 1,                  // Video details
  [YouTubeOperation.VIDEO_INSERT]: 1600,             // Upload (not used in our app)
  [YouTubeOperation.VIDEO_UPDATE]: 50,               // Update metadata (not used)
  [YouTubeOperation.VIDEO_RATE]: 50,                 // Like/dislike (not used)
  [YouTubeOperation.CHANNEL_LIST]: 1,                // Channel info
  [YouTubeOperation.PLAYLIST_ITEMS_LIST]: 1,         // Playlist videos
  [YouTubeOperation.PLAYLIST_LIST]: 1,               // Playlist metadata
  [YouTubeOperation.COMMENT_THREADS_LIST]: 1,        // Comments (not used)
  [YouTubeOperation.COMMENT_INSERT]: 50,             // Post comment (not used)
  [YouTubeOperation.ACTIVITIES_LIST]: 1,             // Activity feed (not used)
  [YouTubeOperation.SUBSCRIPTIONS_LIST]: 1,          // Subscriptions (not used)
};

/**
 * Daily quota limit set by YouTube
 * Default: 10,000 units per day per project
 */
export const DAILY_QUOTA_LIMIT = 10000;

/**
 * Quota alert threshold levels
 */
export enum QuotaAlertLevel {
  INFO = 'INFO',           // 0-50% usage
  WARNING = 'WARNING',     // 50-75% usage
  CRITICAL = 'CRITICAL',   // 75-90% usage
  DEPLETED = 'DEPLETED',   // 90-100% usage
}

/**
 * Quota alert configuration
 */
export const QUOTA_ALERT_THRESHOLDS = {
  [QuotaAlertLevel.INFO]: 0,         // 0% (always available)
  [QuotaAlertLevel.WARNING]: 0.5,    // 50%
  [QuotaAlertLevel.CRITICAL]: 0.75,  // 75%
  [QuotaAlertLevel.DEPLETED]: 0.9,   // 90%
};

/**
 * Sync job priority levels for intelligent queue distribution
 */
export enum SyncPriority {
  CRITICAL = 'CRITICAL',   // Official channels, featured bands
  HIGH = 'HIGH',           // Active bands, recent updates needed
  MEDIUM = 'MEDIUM',       // Regular incremental syncs
  LOW = 'LOW',             // Historical backfills, optional updates
}

/**
 * Priority-based quota allocation
 * Determines how quota should be distributed among different priority levels
 */
export const PRIORITY_QUOTA_ALLOCATION = {
  [SyncPriority.CRITICAL]: 0.3,  // 30% of remaining quota
  [SyncPriority.HIGH]: 0.4,      // 40% of remaining quota
  [SyncPriority.MEDIUM]: 0.2,    // 20% of remaining quota
  [SyncPriority.LOW]: 0.1,       // 10% of remaining quota
};

/**
 * Emergency quota preservation mode thresholds
 */
export const EMERGENCY_MODE_THRESHOLD = 0.95; // Activate at 95% usage

/**
 * Quota usage record interface
 */
export interface QuotaUsageRecord {
  id: string;
  operation: YouTubeOperation;
  cost: number;
  timestamp: Date;
  bandId?: string;
  bandName?: string;
  syncJobId?: string;
  success: boolean;
  cacheHit: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Real-time quota status
 */
export interface QuotaStatus {
  currentUsage: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  alertLevel: QuotaAlertLevel;
  resetTime: Date;
  isEmergencyMode: boolean;
  lastUpdated: Date;
}

/**
 * Quota analytics data
 */
export interface QuotaAnalytics {
  // Current period
  today: {
    used: number;
    remaining: number;
    percentageUsed: number;
    operationBreakdown: Record<YouTubeOperation, number>;
    topConsumers: Array<{
      bandId: string;
      bandName: string;
      quotaUsed: number;
    }>;
  };
  
  // Historical data
  last7Days: {
    averageDaily: number;
    peakDaily: number;
    totalUsed: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  last30Days: {
    averageDaily: number;
    peakDaily: number;
    totalUsed: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  // Efficiency metrics
  efficiency: {
    cacheHitRate: number;
    quotaSavedByCache: number;
    averageCostPerSync: number;
    mostExpensiveOperations: Array<{
      operation: YouTubeOperation;
      count: number;
      totalCost: number;
    }>;
  };
  
  // Forecasting
  forecast: {
    estimatedDailyUsage: number;
    projectedMonthlyUsage: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

/**
 * Quota allocation plan for a sync job
 */
export interface QuotaAllocationPlan {
  jobId: string;
  bandId: string;
  priority: SyncPriority;
  estimatedCost: number;
  allocatedQuota: number;
  approved: boolean;
  reason?: string;
  timestamp: Date;
}

/**
 * Quota optimization suggestions
 */
export interface QuotaOptimization {
  type: 'cache' | 'batch' | 'schedule' | 'priority';
  description: string;
  estimatedSavings: number;
  impact: 'high' | 'medium' | 'low';
  implemented: boolean;
}

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  operations: Array<{
    type: YouTubeOperation;
    params: any;
    priority: SyncPriority;
  }>;
  estimatedCost: number;
  maxRetries: number;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  success: boolean;
  actualCost: number;
  results: any[];
  errors: string[];
  cacheHits: number;
  executionTime: number;
}

/**
 * Quota alert notification
 */
export interface QuotaAlert {
  id: string;
  level: QuotaAlertLevel;
  message: string;
  currentUsage: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Sync job quota metadata
 */
export interface SyncJobQuotaMetadata {
  syncJobId: string;
  bandId: string;
  estimatedCost: number;
  actualCost: number;
  priority: SyncPriority;
  quotaSnapshot: {
    before: number;
    after: number;
  };
  operationBreakdown: Array<{
    operation: YouTubeOperation;
    count: number;
    cost: number;
  }>;
  cacheEfficiency: {
    totalRequests: number;
    cacheHits: number;
    hitRate: number;
  };
}

/**
 * Configuration for quota management
 */
export interface QuotaConfig {
  dailyLimit: number;
  emergencyThreshold: number;
  alertThresholds: Record<QuotaAlertLevel, number>;
  priorityAllocation: Record<SyncPriority, number>;
  enableEmergencyMode: boolean;
  enableAlerts: boolean;
  cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
}