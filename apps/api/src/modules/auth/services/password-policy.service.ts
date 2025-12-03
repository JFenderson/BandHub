import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import * as bcrypt from 'bcrypt';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  expirationDays: number;
  historyCount: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UpdatePasswordPolicyDto {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSymbols?: boolean;
  expirationDays?: number;
  historyCount?: number;
  maxFailedAttempts?: number;
  lockoutDurationMinutes?: number;
}

@Injectable()
export class PasswordPolicyService {
  private readonly BCRYPT_ROUNDS = 12;
  private cachedPolicy: PasswordPolicy | null = null;
  private policyCacheTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(private prisma: DatabaseService) {}

  /**
   * Get the active password policy
   */
  async getActivePolicy(): Promise<PasswordPolicy> {
    // Check cache
    if (this.cachedPolicy && Date.now() - this.policyCacheTime < this.CACHE_TTL) {
      return this.cachedPolicy;
    }

    const policy = await this.prisma.passwordPolicy.findFirst({
      where: { isActive: true },
    });

    if (!policy) {
      // Return default policy if none exists
      return this.getDefaultPolicy();
    }

    this.cachedPolicy = {
      minLength: policy.minLength,
      maxLength: policy.maxLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumbers: policy.requireNumbers,
      requireSymbols: policy.requireSymbols,
      expirationDays: policy.expirationDays,
      historyCount: policy.historyCount,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockoutDurationMinutes: policy.lockoutDurationMinutes,
    };
    this.policyCacheTime = Date.now();

    return this.cachedPolicy;
  }

  /**
   * Get default password policy
   */
  getDefaultPolicy(): PasswordPolicy {
    return {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      expirationDays: 90,
      historyCount: 5,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
    };
  }

  /**
   * Validate a password against the active policy
   */
  async validatePassword(password: string): Promise<PasswordValidationResult> {
    const policy = await this.getActivePolicy();
    const errors: string[] = [];

    // Length checks
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Complexity checks
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a password has been used before
   */
  async isPasswordInHistory(userId: string, password: string): Promise<boolean> {
    const policy = await this.getActivePolicy();

    if (policy.historyCount === 0) {
      return false;
    }

    // Get password history
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: policy.historyCount,
    });

    // Check each historical password
    for (const entry of history) {
      if (await bcrypt.compare(password, entry.passwordHash)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add password to history
   */
  async addToPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    const policy = await this.getActivePolicy();

    if (policy.historyCount === 0) {
      return;
    }

    // Add new entry
    await this.prisma.passwordHistory.create({
      data: {
        userId,
        passwordHash,
      },
    });

    // Clean up old entries beyond history count
    const oldEntries = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: policy.historyCount,
    });

    if (oldEntries.length > 0) {
      await this.prisma.passwordHistory.deleteMany({
        where: {
          id: { in: oldEntries.map((e) => e.id) },
        },
      });
    }
  }

  /**
   * Update the password policy
   */
  async updatePolicy(updates: UpdatePasswordPolicyDto): Promise<PasswordPolicy> {
    // Find or create the active policy
    let policy = await this.prisma.passwordPolicy.findFirst({
      where: { isActive: true },
    });

    if (!policy) {
      policy = await this.prisma.passwordPolicy.create({
        data: {
          name: 'default',
          ...this.getDefaultPolicy(),
          ...updates,
        },
      });
    } else {
      policy = await this.prisma.passwordPolicy.update({
        where: { id: policy.id },
        data: updates,
      });
    }

    // Clear cache
    this.cachedPolicy = null;

    return this.getActivePolicy();
  }

  /**
   * Calculate password expiration date
   */
  async getPasswordExpirationDate(fromDate?: Date): Promise<Date | null> {
    const policy = await this.getActivePolicy();

    if (policy.expirationDays === 0) {
      return null; // Password never expires
    }

    const baseDate = fromDate || new Date();
    const expirationDate = new Date(baseDate);
    expirationDate.setDate(expirationDate.getDate() + policy.expirationDays);

    return expirationDate;
  }

  /**
   * Check if password is expired
   */
  async isPasswordExpired(passwordChangedAt: Date | null): Promise<boolean> {
    if (!passwordChangedAt) {
      return false;
    }

    const expirationDate = await this.getPasswordExpirationDate(passwordChangedAt);

    if (!expirationDate) {
      return false;
    }

    return new Date() > expirationDate;
  }

  /**
   * Hash a password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Compare a password with its hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Change user's password with validation
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.comparePassword(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password against policy
    const validation = await this.validatePassword(newPassword);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join('. '));
    }

    // Check password history
    const isInHistory = await this.isPasswordInHistory(userId, newPassword);
    if (isInHistory) {
      throw new BadRequestException(
        'Cannot reuse a recent password. Please choose a different password.',
      );
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Calculate expiration
    const passwordExpiresAt = await this.getPasswordExpirationDate();

    // Update user password
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        passwordExpiresAt,
        mustChangePassword: false,
      },
    });

    // Add old password to history
    await this.addToPasswordHistory(userId, user.passwordHash);
  }

  /**
   * Force password change on next login
   */
  async forcePasswordChange(userId: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
  }

  /**
   * Get password requirements as a human-readable description
   */
  async getPasswordRequirements(): Promise<string[]> {
    const policy = await this.getActivePolicy();
    const requirements: string[] = [];

    requirements.push(`At least ${policy.minLength} characters`);

    if (policy.requireUppercase) {
      requirements.push('At least one uppercase letter');
    }

    if (policy.requireLowercase) {
      requirements.push('At least one lowercase letter');
    }

    if (policy.requireNumbers) {
      requirements.push('At least one number');
    }

    if (policy.requireSymbols) {
      requirements.push('At least one special character');
    }

    if (policy.historyCount > 0) {
      requirements.push(`Cannot reuse your last ${policy.historyCount} passwords`);
    }

    return requirements;
  }
}
