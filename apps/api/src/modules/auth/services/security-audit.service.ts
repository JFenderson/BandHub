import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../../database/database.service';

/**
 * Audit log severity levels
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Common security event types
 */
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  LOGOUT_ALL = 'logout_all',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REUSE_DETECTED = 'token_reuse_detected',
  ACCOUNT_LOCKED = 'account_locked',
  
  // API Key events
  API_KEY_CREATED = 'api_key_created',
  API_KEY_ROTATED = 'api_key_rotated',
  API_KEY_REVOKED = 'api_key_revoked',
  API_KEY_DELETED = 'api_key_deleted',
  API_KEY_EXPIRATION_WARNING = 'api_key_expiration_warning',
  API_KEY_EXPIRED = 'api_key_expired',
  
  // JWT events
  JWT_KEY_ROTATION_NEEDED = 'jwt_key_rotation_needed',
  JWT_KEY_ROTATED = 'jwt_key_rotated',
  JWT_VERIFICATION_FAILED = 'jwt_verification_failed',
  
  // Access events
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  FORBIDDEN_ACCESS_ATTEMPT = 'forbidden_access_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Secret access events
  SECRET_ACCESSED = 'secret_accessed',
  SECRET_NOT_FOUND = 'secret_not_found',
  SECRET_PROVIDER_FAILED = 'secret_provider_failed',
  
  // Admin events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  ROLE_CHANGED = 'role_changed',
}

/**
 * Audit log entry data
 */
export interface AuditLogEntry {
  action: string | SecurityEventType;
  entityType: string;
  entityId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
  details?: Record<string, any>;
}

/**
 * Query options for audit logs
 */
export interface AuditLogQueryOptions {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Security Audit Service
 * 
 * Provides comprehensive audit logging for security events:
 * - Authentication events (login, logout, token refresh)
 * - API key lifecycle events
 * - JWT key rotation events
 * - Unauthorized access attempts
 * - Secret access events
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  // Retention periods in days by severity
  private readonly retentionDays: Record<AuditSeverity, number> = {
    info: 30,
    warning: 90,
    error: 180,
    critical: 365,
  };

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Log a security event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          userId: entry.userId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          severity: entry.severity || 'info',
          changes: entry.details || {},
        },
      });

      // Log critical events to console as well
      if (entry.severity === 'critical' || entry.severity === 'error') {
        this.logger.warn(
          `[SECURITY ${entry.severity.toUpperCase()}] ${entry.action}: ` +
          `entity=${entry.entityType}:${entry.entityId}, user=${entry.userId || 'system'}`
        );
      }
    } catch (error) {
      // Don't let audit logging failures break the application
      this.logger.error('Failed to create audit log entry:', error);
    }
  }

  /**
   * Log an authentication event
   */
  async logAuth(
    action: SecurityEventType,
    userId: string,
    details?: Record<string, any>,
    request?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const severity: AuditSeverity = 
      action === SecurityEventType.LOGIN_FAILED ? 'warning' :
      action === SecurityEventType.ACCOUNT_LOCKED ? 'error' :
      action === SecurityEventType.TOKEN_REUSE_DETECTED ? 'critical' :
      'info';

    await this.log({
      action,
      entityType: 'auth',
      entityId: userId,
      userId,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      severity,
      details,
    });
  }

  /**
   * Log an API key event
   */
  async logApiKeyEvent(
    action: SecurityEventType,
    apiKeyId: string,
    details?: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    const severity: AuditSeverity =
      action === SecurityEventType.API_KEY_REVOKED ? 'warning' :
      action === SecurityEventType.API_KEY_DELETED ? 'warning' :
      action === SecurityEventType.API_KEY_EXPIRED ? 'warning' :
      'info';

    await this.log({
      action,
      entityType: 'api_key',
      entityId: apiKeyId,
      userId,
      severity,
      details,
    });
  }

  /**
   * Log an unauthorized access attempt
   */
  async logUnauthorizedAccess(
    path: string,
    reason: string,
    request?: { ip?: string; userAgent?: string; userId?: string },
  ): Promise<void> {
    await this.log({
      action: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      entityType: 'access',
      entityId: path,
      userId: request?.userId,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      severity: 'warning',
      details: { reason, path },
    });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditLogQueryOptions): Promise<{
    data: any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const where: any = {};

    if (options.action) where.action = options.action;
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.userId) where.userId = options.userId;
    if (options.severity) where.severity = options.severity;

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const limit = Math.min(options.limit || 100, 1000);
    const offset = options.offset || 0;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  /**
   * Get security event summary (for dashboard)
   */
  async getSecuritySummary(days: number = 7): Promise<{
    totalEvents: number;
    criticalEvents: number;
    errorEvents: number;
    warningEvents: number;
    failedLogins: number;
    successfulLogins: number;
    apiKeyEvents: number;
    unauthorizedAttempts: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalEvents,
      criticalEvents,
      errorEvents,
      warningEvents,
      failedLogins,
      successfulLogins,
      apiKeyEvents,
      unauthorizedAttempts,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, severity: 'critical' },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, severity: 'error' },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, severity: 'warning' },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, action: SecurityEventType.LOGIN_FAILED },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, action: SecurityEventType.LOGIN_SUCCESS },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate }, entityType: 'api_key' },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          action: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        },
      }),
    ]);

    return {
      totalEvents,
      criticalEvents,
      errorEvents,
      warningEvents,
      failedLogins,
      successfulLogins,
      apiKeyEvents,
      unauthorizedAttempts,
    };
  }

  /**
   * Export audit logs to JSON format
   */
  async exportToJson(options: AuditLogQueryOptions): Promise<string> {
    // Override limit for export
    const result = await this.query({ ...options, limit: 10000 });
    return JSON.stringify(result.data, null, 2);
  }

  /**
   * Scheduled task to clean up old audit logs based on retention policy
   * Runs weekly on Sunday at 3 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldLogs(): Promise<void> {
    this.logger.log('Running audit log cleanup...');

    for (const [severity, retentionDays] of Object.entries(this.retentionDays)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          severity,
          createdAt: { lt: cutoffDate },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Deleted ${result.count} ${severity} audit logs older than ${retentionDays} days`
        );
      }
    }
  }
}
