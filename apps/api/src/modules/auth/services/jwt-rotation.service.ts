import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../../database/database.service';
import * as crypto from 'crypto';

/**
 * JWT key information for rotation
 */
export interface JwtKeyInfo {
  keyId: string;
  version: number;
  secret: string;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * JWT payload with key ID for rotation support
 */
export interface JwtPayloadWithKeyId {
  sub: string;
  email: string;
  role: string;
  kid?: string; // Key ID for rotation tracking
  iat?: number;
  exp?: number;
}

/**
 * JWT Rotation Service
 * 
 * Implements multi-key JWT strategy with graceful key rollover:
 * - Supports multiple active keys for zero-downtime rotation
 * - Automatic key rotation scheduling
 * - Validates tokens signed with current or previous keys
 * - Tracks key versions and timestamps
 */
@Injectable()
export class JwtRotationService implements OnModuleInit {
  private readonly logger = new Logger(JwtRotationService.name);
  
  // In-memory key cache for fast access
  private currentKey: JwtKeyInfo | null = null;
  private previousKey: JwtKeyInfo | null = null;
  
  // Configuration
  private readonly rotationIntervalDays: number;
  private readonly keyExpirationDays: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: DatabaseService,
  ) {
    // Get rotation configuration from environment
    this.rotationIntervalDays = this.configService.get<number>('JWT_ROTATION_INTERVAL_DAYS', 30);
    this.keyExpirationDays = this.rotationIntervalDays * 2; // Keys are valid for 2 rotation cycles
  }

  async onModuleInit(): Promise<void> {
    await this.initializeKeys();
  }

  /**
   * Initialize JWT keys on startup
   * Loads existing keys from database or creates initial keys from environment
   */
  private async initializeKeys(): Promise<void> {
    this.logger.log('Initializing JWT keys...');

    // Try to load keys from database
    const dbKeys = await this.prisma.jwtKey.findMany({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (dbKeys.length === 0) {
      // No keys in database - initialize from environment
      await this.initializeFromEnvironment();
    } else {
      // Load keys from database
      await this.loadKeysFromDatabase(dbKeys);
    }

    this.logKeyStatus();
  }

  /**
   * Initialize keys from environment variables (first-time setup)
   */
  private async initializeFromEnvironment(): Promise<void> {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const previousSecret = this.configService.get<string>('JWT_PREVIOUS_SECRET');

    // Create the primary key
    const keyId = this.generateKeyId();
    await this.prisma.jwtKey.create({
      data: {
        keyId,
        version: 1,
        isActive: true,
        isPrimary: true,
        expiresAt: this.calculateExpirationDate(),
      },
    });

    this.currentKey = {
      keyId,
      version: 1,
      secret,
      isActive: true,
      isPrimary: true,
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
    };

    // If there's a previous secret configured, add it as a fallback
    if (previousSecret) {
      const previousKeyId = this.generateKeyId();
      await this.prisma.jwtKey.create({
        data: {
          keyId: previousKeyId,
          version: 0,
          isActive: true,
          isPrimary: false,
          rotatedAt: new Date(),
        },
      });

      this.previousKey = {
        keyId: previousKeyId,
        version: 0,
        secret: previousSecret,
        isActive: true,
        isPrimary: false,
        createdAt: new Date(),
      };
    }

    this.logger.log('JWT keys initialized from environment');
  }

  /**
   * Load keys from database records
   */
  private async loadKeysFromDatabase(dbKeys: any[]): Promise<void> {
    // Current primary key comes from environment, but metadata from DB
    const primaryKeyRecord = dbKeys.find(k => k.isPrimary);
    const previousKeyRecord = dbKeys.find(k => !k.isPrimary && k.isActive);

    const currentSecret = this.configService.get<string>('JWT_SECRET');
    if (!currentSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    if (primaryKeyRecord) {
      this.currentKey = {
        keyId: primaryKeyRecord.keyId,
        version: primaryKeyRecord.version,
        secret: currentSecret,
        isActive: primaryKeyRecord.isActive,
        isPrimary: primaryKeyRecord.isPrimary,
        createdAt: primaryKeyRecord.createdAt,
        expiresAt: primaryKeyRecord.expiresAt,
      };
    } else {
      // Create new primary key entry
      const keyId = this.generateKeyId();
      await this.prisma.jwtKey.create({
        data: {
          keyId,
          version: 1,
          isActive: true,
          isPrimary: true,
          expiresAt: this.calculateExpirationDate(),
        },
      });

      this.currentKey = {
        keyId,
        version: 1,
        secret: currentSecret,
        isActive: true,
        isPrimary: true,
        createdAt: new Date(),
        expiresAt: this.calculateExpirationDate(),
      };
    }

    // Load previous key if configured
    const previousSecret = this.configService.get<string>('JWT_PREVIOUS_SECRET');
    if (previousSecret && previousKeyRecord) {
      this.previousKey = {
        keyId: previousKeyRecord.keyId,
        version: previousKeyRecord.version,
        secret: previousSecret,
        isActive: previousKeyRecord.isActive,
        isPrimary: false,
        createdAt: previousKeyRecord.createdAt,
        expiresAt: previousKeyRecord.expiresAt,
      };
    }

    this.logger.log('JWT keys loaded from database');
  }

  /**
   * Sign a JWT token using the current primary key
   */
  sign(payload: Omit<JwtPayloadWithKeyId, 'kid'>, options?: JwtSignOptions): string {
    if (!this.currentKey) {
      throw new Error('JWT signing key not initialized');
    }

    // Add key ID to payload for rotation tracking
    const payloadWithKid: JwtPayloadWithKeyId = {
      ...payload,
      kid: this.currentKey.keyId,
    };

    return this.jwtService.sign(payloadWithKid, {
      ...options,
      secret: this.currentKey.secret,
    });
  }

  /**
   * Verify and decode a JWT token
   * Tries current key first, falls back to previous key for rotation support
   */
  async verify<T extends JwtPayloadWithKeyId>(token: string, options?: JwtVerifyOptions): Promise<T> {
    // Try with current key first
    if (this.currentKey) {
      try {
        return this.jwtService.verify<T>(token, {
          ...options,
          secret: this.currentKey.secret,
        });
      } catch (error) {
        // Continue to try previous key
      }
    }

    // Try with previous key for rotation support
    if (this.previousKey) {
      try {
        return this.jwtService.verify<T>(token, {
          ...options,
          secret: this.previousKey.secret,
        });
      } catch (error) {
        // Both keys failed
      }
    }

    throw new Error('Invalid token: signature verification failed');
  }

  /**
   * Check if a key rotation is needed
   */
  isRotationNeeded(): boolean {
    if (!this.currentKey) return true;
    if (!this.currentKey.expiresAt) return false;

    // Check if we're within the rotation window (7 days before expiration)
    const rotationWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const now = Date.now();
    const expiresAt = this.currentKey.expiresAt.getTime();

    return now >= expiresAt - rotationWindow;
  }

  /**
   * Get key status information
   */
  getKeyStatus(): {
    currentKey: { keyId: string; version: number; expiresAt?: Date } | null;
    previousKey: { keyId: string; version: number } | null;
    rotationNeeded: boolean;
    nextRotation?: Date;
  } {
    return {
      currentKey: this.currentKey
        ? {
            keyId: this.currentKey.keyId,
            version: this.currentKey.version,
            expiresAt: this.currentKey.expiresAt,
          }
        : null,
      previousKey: this.previousKey
        ? {
            keyId: this.previousKey.keyId,
            version: this.previousKey.version,
          }
        : null,
      rotationNeeded: this.isRotationNeeded(),
      nextRotation: this.currentKey?.expiresAt,
    };
  }

  /**
   * Get the current secret (for backward compatibility)
   */
  getCurrentSecret(): string {
    if (!this.currentKey) {
      throw new Error('JWT signing key not initialized');
    }
    return this.currentKey.secret;
  }

  /**
   * Scheduled task to check for key rotation (runs daily at midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkKeyRotation(): Promise<void> {
    this.logger.log('Checking JWT key rotation status...');

    if (this.isRotationNeeded()) {
      this.logger.warn('JWT key rotation is needed! Please rotate keys manually or configure new secrets.');
      
      // Log audit event
      await this.prisma.auditLog.create({
        data: {
          action: 'jwt_key_rotation_needed',
          entityType: 'security',
          entityId: this.currentKey?.keyId || 'unknown',
          severity: 'warning',
          changes: {
            message: 'JWT key rotation is needed',
            currentKeyVersion: this.currentKey?.version,
            expiresAt: this.currentKey?.expiresAt,
          },
        },
      });
    }
  }

  /**
   * Scheduled task to clean up expired keys (runs weekly on Sunday at 2 AM)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupExpiredKeys(): Promise<void> {
    this.logger.log('Cleaning up expired JWT keys...');

    const result = await this.prisma.jwtKey.updateMany({
      where: {
        isActive: true,
        isPrimary: false,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        isActive: false,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deactivated ${result.count} expired JWT keys`);
    }
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return `key_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calculate expiration date for a new key
   */
  private calculateExpirationDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.keyExpirationDays);
    return date;
  }

  /**
   * Log current key status
   */
  private logKeyStatus(): void {
    if (this.currentKey) {
      this.logger.log(`Current key: ${this.currentKey.keyId} (v${this.currentKey.version})`);
      if (this.currentKey.expiresAt) {
        this.logger.log(`  Expires: ${this.currentKey.expiresAt.toISOString()}`);
      }
    }
    if (this.previousKey) {
      this.logger.log(`Previous key: ${this.previousKey.keyId} (v${this.previousKey.version})`);
    }
    this.logger.log(`Rotation interval: ${this.rotationIntervalDays} days`);
  }
}
