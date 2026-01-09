import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@bandhub/database';
import { CacheStrategyService, CACHE_TTL } from '@bandhub/cache';
import { CacheKeyBuilder } from '@bandhub/cache';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminRole } from '@prisma/client';

/**
 * AuthService with session caching
 * 
 * Caching strategy:
 * - User sessions: 24 hours (invalidated on logout/password change)
 * - Refresh tokens: 7 days (invalidated on logout/rotation)
 * - User preferences: 24 hours (invalidated on update)
 * 
 * Benefits:
 * - Reduces database load for auth checks
 * - Faster token validation
 * - Immediate session invalidation across servers
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheStrategy: CacheStrategyService,
  ) {}

  /**
   * Register new user
   */
  async register(data: RegisterDto) {
    // Check if user already exists
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new UnauthorizedException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // FIX: Ensure role is proper AdminRole type
    const role = (data.role || AdminRole.MODERATOR) as AdminRole;

    // Create user
    const user = await this.prisma.adminUser.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        role: role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    return user;
  }

  /**
   * Login user and create session
   * Caches user session data for fast subsequent auth checks
   */
  async login(data: LoginDto) {
    // Find user
    const user = await this.prisma.adminUser.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Cache user session data (without password)
    const sessionKey = CacheKeyBuilder.userSession(user.id);
    await this.cacheStrategy.set(sessionKey, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }, CACHE_TTL.USER_SESSION);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Logout user
   * Invalidates all user sessions and tokens
   */
  async logout(userId: string) {
    // Invalidate all user caches
    await this.cacheStrategy.invalidateUserCaches(userId);

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   * Invalidates all sessions for this user
   */
  async logoutAll(userId: string) {
    // Same as logout - invalidates all user sessions
    await this.cacheStrategy.invalidateUserCaches(userId);
    
    this.logger.log(`User logged out from all devices: ${userId}`);
    
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Refresh access token
   * Validates refresh token and issues new access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      
      // Check if refresh token is in cache (not revoked)
      const tokenKey = CacheKeyBuilder.userRefreshToken(payload.jti);
      const isValid = await this.cacheStrategy.get(tokenKey);

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user from cache or database
      const user = await this.getUserById(payload.sub);

      // Generate new access token
      const accessToken = await this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get user by ID with caching
   * Used for token validation and auth guards
   */
  async getUserById(userId: string) {
    const sessionKey = CacheKeyBuilder.userSession(userId);

    return this.cacheStrategy.wrap(
      sessionKey,
      async () => {
        const user = await this.prisma.adminUser.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        return user;
      },
      CACHE_TTL.USER_SESSION,
    );
  }

  /**
   * Change user password
   * Invalidates all sessions to force re-login
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Invalidate all user sessions to force re-login
    await this.cacheStrategy.invalidateUserCaches(userId);

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully. Please login again.' };
  }

  /**
   * Send admin password reset email
   * In a real app, this would send an email with a reset token
   */
  async sendAdminPasswordReset(email: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token (in real app, send via email)
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'password-reset' },
      { expiresIn: '1h' }
    );

    // In a real app, you would:
    // 1. Store the token in database with expiry
    // 2. Send email with reset link containing token
    // For now, just log it
    this.logger.log(`Password reset token generated for ${email}: ${resetToken}`);

    return { 
      message: 'If the email exists, a reset link has been sent',
      // Remove this in production - only for development
      token: resetToken,
    };
  }

  /**
   * Reset admin password using token
   */
  async resetAdminPassword(token: string, newPassword: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      
      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid reset token');
      }

      const userId = payload.sub;

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });

      // Invalidate all sessions
      await this.cacheStrategy.invalidateUserCaches(userId);

      this.logger.log(`Password reset successful for user: ${userId}`);

      return { message: 'Password reset successful. Please login with your new password.' };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  /**
   * Generate JWT access token
   */
  private async generateAccessToken(
    userId: string,
    email: string,
    role: AdminRole,
  ): Promise<string> {
    const payload = {
      sub: userId,
      email,
      role,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
    });
  }

  /**
   * Generate JWT refresh token
   * Also caches it for validation
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = `${userId}-${Date.now()}`;
    
    const payload = {
      sub: userId,
      jti: tokenId,
      type: 'refresh',
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
    });

    // Cache refresh token for validation
    const tokenKey = CacheKeyBuilder.userRefreshToken(tokenId);
    await this.cacheStrategy.set(tokenKey, { valid: true }, 7 * 24 * 60 * 60); // 7 days

    return token;
  }
}