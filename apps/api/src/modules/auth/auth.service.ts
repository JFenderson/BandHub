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

@Injectable()
export class AuthService {
  // Constants for security configuration
  private readonly ACCESS_TOKEN_EXPIRY = '7d';
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
  ): Promise<LoginResponseDto> {
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

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
    );

    // Log successful login
    await this.logAudit(user.id, 'login_success', {
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using refresh token
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
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked (possible token reuse attack)
    if (tokenRecord.isRevoked) {
      // Token reuse detected - revoke all tokens for this user
      await this.revokeAllUserTokens(tokenRecord.userId);
      
      await this.logAudit(tokenRecord.userId, 'token_reuse_detected', {
        tokenId: tokenRecord.id,
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

    // Rotate tokens: revoke old token and create new ones
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(tokenRecord.user);
    const newRefreshToken = await this.generateRefreshToken(
      tokenRecord.user.id,
      ipAddress,
      userAgent,
      tokenRecord.id, // Link to previous token for audit trail
    );

    // Update replacedBy field for audit trail
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { replacedBy: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 7 * 24 * 60 * 60,
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
  private generateAccessToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Generate and store refresh token
   */
  private async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    previousTokenId?: string,
  ): Promise<string> {
    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(64).toString('hex');
    const hashedToken = this.hashToken(token);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // Store in database
    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Return the plain token (only time it's available)
    return token;
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