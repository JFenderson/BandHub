import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@bandhub/database';
import { randomBytes } from 'crypto';

/**
 * API Key expiration warning thresholds in days
 */
const EXPIRATION_WARNING_DAYS = [30, 14, 7, 3, 1];

/**
 * Service for managing API keys with expiration and rotation support
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new API key
   * Format: bhub_live_[32 random hex characters]
   */
  private generateApiKey(): string {
    const randomHex = randomBytes(32).toString('hex');
    return `bhub_live_${randomHex}`;
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: {
    name: string;
    description?: string;
    expiresAt?: Date;
    expiresInDays?: number;
  }) {
    const key = this.generateApiKey();
    
    // Calculate expiration date
    let expiresAt = data.expiresAt;
    if (!expiresAt && data.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
    }

    const apiKey = await this.prisma.apiKey.create({
      data: {
        key,
        name: data.name,
        description: data.description,
        expiresAt,
      },
    });

    this.logger.log(`Created API key: ${apiKey.name} (${apiKey.id})`);

    // Log audit event
    await this.logAuditEvent('api_key_created', apiKey.id, {
      name: apiKey.name,
      expiresAt: expiresAt?.toISOString(),
    });

    return apiKey;
  }

  /**
   * List all API keys (excluding the actual key value for security)
   */
  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        lastRotatedAt: true,
        usageCount: true,
        rotationWarningsSent: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single API key by ID
   */
  async getApiKeyById(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        lastRotatedAt: true,
        usageCount: true,
        rotationWarningsSent: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    return apiKey;
  }

  /**
   * Validate an API key (check if it exists, is active, and not expired)
   */
  async validateApiKey(key: string): Promise<{ id: string; name: string } | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key },
      select: {
        id: true,
        name: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    if (!apiKey.isActive) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update usage statistics (fire and forget)
    this.updateUsageStats(apiKey.id).catch(err => {
      this.logger.warn(`Failed to update usage stats: ${err.message}`);
    });

    return { id: apiKey.id, name: apiKey.name };
  }

  /**
   * Update API key usage statistics
   */
  private async updateUsageStats(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Rotate an API key (create a new key, deactivate the old one)
   * Returns both the new key (with the actual key value) and grace period info
   */
  async rotateApiKey(id: string, gracePeriodDays: number = 7) {
    const existingKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    // Generate new key value
    const newKeyValue = this.generateApiKey();
    
    // Calculate new expiration (same duration as original if it had one)
    let newExpiresAt: Date | null = null;
    if (existingKey.expiresAt) {
      const originalDuration = existingKey.expiresAt.getTime() - existingKey.createdAt.getTime();
      newExpiresAt = new Date(Date.now() + originalDuration);
    }

    // Update the existing key with the new value
    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        key: newKeyValue,
        lastRotatedAt: new Date(),
        rotationWarningsSent: 0,
        expiresAt: newExpiresAt,
      },
    });

    this.logger.log(`Rotated API key: ${existingKey.name} (${id})`);

    // Log audit event
    await this.logAuditEvent('api_key_rotated', id, {
      name: existingKey.name,
      newExpiresAt: newExpiresAt?.toISOString(),
    });

    return {
      ...updatedKey,
      key: newKeyValue, // Include the actual new key value
      gracePeriodEnds: gracePeriodDays > 0
        ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
        : undefined,
    };
  }

  /**
   * Extend an API key's expiration date
   */
  async extendExpiration(id: string, additionalDays: number) {
    if (additionalDays <= 0) {
      throw new BadRequestException('Additional days must be positive');
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    const currentExpiration = apiKey.expiresAt || new Date();
    const newExpiration = new Date(currentExpiration);
    newExpiration.setDate(newExpiration.getDate() + additionalDays);

    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        expiresAt: newExpiration,
        rotationWarningsSent: 0, // Reset warnings
      },
    });

    this.logger.log(`Extended API key expiration: ${apiKey.name} (${id}) to ${newExpiration.toISOString()}`);

    return updatedKey;
  }

  /**
   * Get API keys that are expiring soon
   */
  async getExpiringKeys(daysThreshold: number = 7) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    return this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lte: thresholdDate,
          gt: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        expiresAt: true,
        lastUsedAt: true,
        rotationWarningsSent: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
        lastRotatedAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    // Calculate usage rate
    const daysSinceCreation = Math.max(1, 
      (Date.now() - apiKey.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    const usagePerDay = apiKey.usageCount / daysSinceCreation;

    return {
      ...apiKey,
      usagePerDay: Math.round(usagePerDay * 100) / 100,
      daysSinceCreation: Math.round(daysSinceCreation),
    };
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(id: string) {
    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.warn(`Revoked API key: ${apiKey.name} (${apiKey.id})`);

    // Log audit event
    await this.logAuditEvent('api_key_revoked', id, {
      name: apiKey.name,
    }, 'warning');

    return apiKey;
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(id: string) {
    const apiKey = await this.prisma.apiKey.delete({
      where: { id },
    });

    this.logger.warn(`Deleted API key: ${apiKey.name} (${apiKey.id})`);

    // Log audit event
    await this.logAuditEvent('api_key_deleted', id, {
      name: apiKey.name,
    }, 'warning');

    return apiKey;
  }

  /**
   * Scheduled task to check for expiring API keys (runs daily at 9 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringKeys(): Promise<void> {
    this.logger.log('Checking for expiring API keys...');

    for (const days of EXPIRATION_WARNING_DAYS) {
      const expiringKeys = await this.getKeysExpiringInDays(days);

      for (const key of expiringKeys) {
        // Determine warning level based on days
        const warningLevel = this.getWarningLevel(days);
        
        // Check if we've already sent this level of warning
        if (key.rotationWarningsSent >= warningLevel) {
          continue;
        }

        this.logger.warn(
          `API key "${key.name}" (${key.id}) expires in ${days} days`
        );

        // Update warning sent count
        await this.prisma.apiKey.update({
          where: { id: key.id },
          data: { rotationWarningsSent: warningLevel },
        });

        // Log audit event
        await this.logAuditEvent('api_key_expiration_warning', key.id, {
          name: key.name,
          expiresAt: key.expiresAt?.toISOString(),
          daysUntilExpiration: days,
          warningLevel,
        }, 'warning');
      }
    }
  }

  /**
   * Get keys expiring in exactly N days
   */
  private async getKeysExpiringInDays(days: number) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      select: {
        id: true,
        name: true,
        expiresAt: true,
        rotationWarningsSent: true,
      },
    });
  }

  /**
   * Get warning level based on days until expiration
   */
  private getWarningLevel(days: number): number {
    const index = EXPIRATION_WARNING_DAYS.indexOf(days);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Log an audit event
   */
  private async logAuditEvent(
    action: string,
    entityId: string,
    details: Record<string, any>,
    severity: string = 'info',
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'api_key',
          entityId,
          changes: details,
          severity,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create audit log: ${error}`);
    }
  }
}