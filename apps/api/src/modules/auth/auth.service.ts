import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import * as crypto from 'crypto';

export interface LoginOptions {
  mfaToken?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class AuthService {
  // Constants for security configuration
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // Reduced from 7d for better security
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    private prisma: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new admin user
   */
  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash, // Use passwordHash to match schema
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Login user and return tokens
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
    options?: LoginOptions,
  ): Promise<LoginResponseDto & { requiresMfa?: boolean }> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account is locked. Try again in ${minutesLeft} minutes.`,
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password (use passwordHash field)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed attempts
      await this.handleFailedLogin(user.id);

      // Log failed attempt
      await this.logAudit(user.id, 'login_failed', {
        email,
        ipAddress,
        reason: 'Invalid password',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      if (!options?.mfaToken) {
        // Return partial response indicating MFA is required
        return {
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          requiresMfa: true,
        };
      }

      // Verify MFA token
      const isMfaValid = await this.verifyMfaToken(user.id, options.mfaToken);
      if (!isMfaValid) {
        await this.logAudit(user.id, 'mfa_failed', { ipAddress });
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Check if password is expired
    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
      throw new UnauthorizedException('Password has expired. Please reset your password.');
    }

    // Create a session
    const sessionId = await this.createSession(
      user.id,
      ipAddress,
      userAgent,
      options?.deviceFingerprint,
    );

    // Reset failed attempts and update session info
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Generate tokens with session ID
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
      undefined,
      sessionId,
      options?.deviceFingerprint,
    );

    // Log successful login
    await this.logAudit(user.id, 'login_success', {
      ipAddress,
      userAgent,
      sessionId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using refresh token with rotation
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefreshTokenResponseDto> {
    // Hash the provided token to compare with database
    const hashedToken = this.hashToken(refreshToken);

    // Find refresh token in database
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true, session: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked (possible token reuse attack)
    if (tokenRecord.isRevoked) {
      // Token reuse detected - revoke all tokens for this session/user
      if (tokenRecord.sessionId) {
        // Revoke entire session
        await this.prisma.adminSession.update({
          where: { id: tokenRecord.sessionId },
          data: {
            isActive: false,
            revokedAt: new Date(),
            revokedReason: 'token_reuse_detected',
          },
        });
      }
      
      await this.revokeAllUserTokens(tokenRecord.userId);
      
      await this.logAudit(tokenRecord.userId, 'refresh_reuse_detected', {
        tokenId: tokenRecord.id,
        sessionId: tokenRecord.sessionId,
        ipAddress,
      });

      throw new UnauthorizedException(
        'Token reuse detected. All sessions have been terminated.',
      );
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if session is still active
    if (tokenRecord.session && !tokenRecord.session.isActive) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Rotate tokens: revoke old token and create new ones
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'rotated',
      },
    });

    // Update session activity
    if (tokenRecord.sessionId) {
      await this.prisma.adminSession.update({
        where: { id: tokenRecord.sessionId },
        data: { lastActivityAt: new Date() },
      });
    }

    // Generate new tokens with same session
    const newAccessToken = this.generateAccessToken(tokenRecord.user, tokenRecord.sessionId);
    const newRefreshToken = await this.generateRefreshToken(
      tokenRecord.user.id,
      ipAddress,
      userAgent,
      tokenRecord.id, // Link to previous token for audit trail
      tokenRecord.sessionId,
      tokenRecord.deviceFingerprint,
    );

    // Update replacedBy field with hashed new token for audit trail
    const hashedNewToken = this.hashToken(newRefreshToken);
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { replacedBy: hashedNewToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60, // 15 minutes
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string, userId: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        token: hashedToken,
        userId,
      },
    });

    if (tokenRecord) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      await this.logAudit(userId, 'logout', {
        tokenId: tokenRecord.id,
      });
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
    await this.logAudit(userId, 'logout_all', {});
  }

  /**
   * Validate user from JWT payload
   */
  async validateUser(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  // ============ PRIVATE HELPER METHODS ============

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: any, sessionId?: string | null): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionId || undefined,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Generate and store refresh token with session binding
   */
  private async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    previousTokenId?: string,
    sessionId?: string | null,
    deviceFingerprint?: string,
  ): Promise<string> {
    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(64).toString('hex');
    const hashedToken = this.hashToken(token);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // Store in database with session binding
    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
        sessionId: sessionId || undefined,
        deviceFingerprint,
      },
    });

    // Return the plain token (only time it's available)
    return token;
  }

  /**
   * Create a new session for a user
   */
  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // Generate a unique token chain ID for tracking token rotation
    const tokenChainId = crypto.randomBytes(32).toString('hex');

    // Parse user agent for device info
    const deviceInfo = this.parseUserAgent(userAgent);

    // Create the session
    const session = await this.prisma.adminSession.create({
      data: {
        userId,
        ipAddress,
        userAgent,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceFingerprint,
        expiresAt,
        tokenChainId,
        isActive: true,
      },
    });

    return session.id;
  }

  /**
   * Parse user agent string to extract device info
   */
  private parseUserAgent(userAgent?: string): {
    deviceType: string | null;
    browser: string | null;
    os: string | null;
  } {
    if (!userAgent) {
      return { deviceType: null, browser: null, os: null };
    }

    // Simple user agent parsing
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Extract browser
    let browser = 'Unknown';
    if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/edge|edg/i.test(userAgent)) {
      browser = 'Edge';
    }

    // Extract OS
    let os = 'Unknown';
    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/macintosh|mac os/i.test(userAgent)) {
      os = 'macOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      os = 'iOS';
    }

    return { deviceType, browser, os };
  }

  /**
   * Verify MFA token (TOTP or backup code)
   */
  private async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    // Get encryption key
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    let encryptionKey: Buffer;
    if (!key) {
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
      encryptionKey = crypto.createHash('sha256').update(jwtSecret).digest();
    } else {
      encryptionKey = Buffer.from(key, 'hex');
    }

    // Decrypt the secret
    const [ivHex, encrypted] = user.mfaSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
    let secret = decipher.update(encrypted, 'hex', 'utf8');
    secret += decipher.final('utf8');

    // Verify TOTP
    if (this.verifyTotp(secret, token)) {
      return true;
    }

    // Try backup code
    const hashedCode = crypto.createHash('sha256')
      .update(token.toUpperCase().replace(/-/g, ''))
      .digest('hex');
    const codeIndex = user.mfaBackupCodes.findIndex((c) => c === hashedCode);

    if (codeIndex !== -1) {
      // Remove used backup code
      const updatedCodes = [...user.mfaBackupCodes];
      updatedCodes.splice(codeIndex, 1);
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: { mfaBackupCodes: updatedCodes },
      });
      return true;
    }

    return false;
  }

  /**
   * Verify TOTP token
   */
  private verifyTotp(secret: string, token: string): boolean {
    const TOTP_PERIOD = 30;
    const TOTP_DIGITS = 6;

    const time = Math.floor(Date.now() / 1000);

    // Check current, previous, and next time periods
    for (let i = -1; i <= 1; i++) {
      const counter = Math.floor((time + i * TOTP_PERIOD) / TOTP_PERIOD);
      const expected = this.generateTotpToken(secret, counter);
      if (token === expected) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate TOTP token
   */
  private generateTotpToken(secret: string, counter: number): string {
    const TOTP_DIGITS = 6;

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const secretBuffer = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
  }

  /**
   * Base32 decode
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

    const output: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of cleanedInput) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Handle failed login attempts and account lockout
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const newFailedAttempts = user.failedLoginAttempts + 1;

    // Lock account if max attempts reached
    if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(
        lockedUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES,
      );

      await this.prisma.adminUser.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil,
        },
      });

      await this.logAudit(userId, 'account_locked', {
        reason: 'Too many failed login attempts',
        lockedUntil,
      });
    } else {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: newFailedAttempts,
        },
      });
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

/**
 * Log audit trail
 */
private async logAudit(
  userId: string,
  action: string,
  details: any,
): Promise<void> {
  try {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'auth', // Required by your schema
        entityId: userId,   // Required by your schema
        changes: details,   // Your schema uses 'changes' as Json type, not 'details'
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to create audit log:', error);
  }
}

  /**
   * Clean up expired refresh tokens (call this periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}