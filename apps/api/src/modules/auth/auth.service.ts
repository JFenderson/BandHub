import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@bandhub/database';
import { CacheStrategyService, CACHE_TTL } from '@bandhub/cache';
import { CacheKeyBuilder } from '@bandhub/cache';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminRole, UserRole } from '@prisma/client';

/**
 * User type discriminator for JWT tokens
 */
export type UserType = 'user' | 'admin';

/**
 * Unified user interface for both User and AdminUser
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | AdminRole;
  userType: UserType;
  createdAt: Date;
}

/**
 * AuthService with session caching and dual user type support
 * 
 * Supports two user tables:
 * - User: Regular users (fans, visitors)
 * - AdminUser: Admin/staff users (moderators, admins)
 * 
 * Caching strategy:
 * - User sessions: 24 hours (invalidated on logout/password change)
 * - Refresh tokens: 7 days (invalidated on logout/rotation)
 * - User preferences: 24 hours (invalidated on update)
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
   * Register new user (regular User table)
   */
  async register(data: RegisterDto): Promise<any> {
    // Check if user already exists in User table
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new UnauthorizedException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Default role for regular users
    const role = (data.role as UserRole) || UserRole.USER;

    // Create user in User table
    const user = await this.prisma.user.create({
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

    // Generate tokens with userType
    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
      'user', // Regular user type
    );
    const refreshToken = await this.generateRefreshToken(user.id, 'user');

    // Cache user session
    const sessionKey = CacheKeyBuilder.userSession(user.id);
    await this.cacheStrategy.set(
      sessionKey,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType: 'user',
      },
      CACHE_TTL.USER_SESSION,
      false
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Register new admin user (AdminUser table)
   */
  async registerAdmin(data: RegisterDto): Promise<any> {
    // Check if admin already exists
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new UnauthorizedException('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Default role for admin users
    const role = (data.role as AdminRole) || AdminRole.MODERATOR;

    // Create admin user
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

    this.logger.log(`New admin registered: ${user.email}`);

    // Generate tokens with userType
    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
      'admin', // Admin user type
    );
    const refreshToken = await this.generateRefreshToken(user.id, 'admin');

    // Cache admin session
    const sessionKey = CacheKeyBuilder.userSession(user.id);
    await this.cacheStrategy.set(
      sessionKey,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType: 'admin',
      },
      CACHE_TTL.USER_SESSION,
      false
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Login user (checks both User and AdminUser tables)
   */
  async login(data: LoginDto) {
    // Try User table first
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    let userType: UserType = 'user';
    let passwordHash: string | null = null;

    if (user) {
      passwordHash = user.passwordHash;
    } else {
      // Try AdminUser table
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { email: data.email },
      });

      if (adminUser) {
        user = adminUser as any;
        userType = 'admin';
        passwordHash = adminUser.passwordHash;
      }
    }

    if (!user || !passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

// Only check admin-specific security fields for AdminUser
if (userType === 'admin') {
  const adminUser = user as any; // Cast since we know it's AdminUser
  
  // CHECK 1: Account active status (AdminUser only)
  if (adminUser.isActive === false) {
    this.logger.warn(`Login attempt for inactive admin account: ${user.email}`);
    throw new UnauthorizedException('Invalid credentials');
  }

  // CHECK 2: Account lockout (AdminUser only)
  if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((adminUser.lockedUntil.getTime() - Date.now()) / 60000);
    this.logger.warn(`Login attempt for locked admin account: ${user.email}`);
    throw new UnauthorizedException(
      `Account is temporarily locked. Please try again in ${minutesLeft} minutes.`
    );
  }
}

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    

if (!isPasswordValid) {
  // Only track failed attempts for AdminUser
  if (userType === 'admin') {
    const adminUser = user as any;
    const newFailedAttempts = (adminUser.failedLoginAttempts || 0) + 1;
    const maxAttempts = 5;
    
    const updateData: any = {
      failedLoginAttempts: newFailedAttempts,
    };
    
    if (newFailedAttempts >= maxAttempts) {
      const lockoutMinutes = 15;
      updateData.lockedUntil = new Date(Date. now() + lockoutMinutes * 60000);
      this.logger.warn(`Admin account locked due to failed attempts: ${user.email}`);
    }
    
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: updateData,
    });
  }
  
  throw new UnauthorizedException('Invalid credentials');
}


    // SUCCESS: Update user state
if (userType === 'admin') {
  await this.prisma.adminUser.update({
    where: { id:  user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: data.ipAddress || null,
      failedLoginAttempts: 0,
      lockedUntil:  null,
    },
  });
} else {
  // For regular users, just update lastSeenAt
  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenAt: new Date(),
    },
  });
}
    // Generate tokens with correct userType
    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
      userType,
    );
    const refreshToken = await this.generateRefreshToken(user.id, userType);

    // Cache user session
    const sessionKey = CacheKeyBuilder.userSession(user.id);
    await this.cacheStrategy.set(
      sessionKey,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType,
      },
      CACHE_TTL.USER_SESSION,
      false
    );

    this.logger.log(`User logged in: ${user.email} (${userType})`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
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
   */
  async logout(userId: string) {
    await this.cacheStrategy.invalidateUserCaches(userId);
    this.logger.log(`User logged out: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string) {
    await this.cacheStrategy.invalidateUserCaches(userId);
    this.logger.log(`User logged out from all devices: ${userId}`);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);

      // Check if refresh token is valid
      const tokenKey = CacheKeyBuilder.userRefreshToken(payload.jti);
      const isValid = await this.cacheStrategy.get(tokenKey);

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user from cache or database
      const userType: UserType = payload.userType || 'user';
      const user = await this.getUserById(payload.sub, userType);

      // Generate new access token
      const accessToken = await this.generateAccessToken(
        user.id,
        user.email,
        user.role,
        userType,
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get user by ID with caching
   * Queries the correct table based on userType
   */
  async getUserById(userId: string, userType: UserType = 'user'): Promise<AuthUser> {
    if (!userId) {
      throw new UnauthorizedException('Invalid user ID');
    }

    const sessionKey = CacheKeyBuilder.userSession(userId);

    return this.cacheStrategy.wrap(
      sessionKey,
      async () => {
        let user: any;

        if (userType === 'admin') {
          user = await this.prisma.adminUser.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          });
        } else {
          user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          });
        }

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        return {
          ...user,
          userType,
        };
      },
      CACHE_TTL.USER_SESSION,
     {compress: false}
    );
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    userType: UserType,
    oldPassword: string,
    newPassword: string,
  ) {
    let user: any;
    let passwordHash: string;

    if (userType === 'admin') {
      user = await this.prisma.adminUser.findUnique({
        where: { id: userId },
      });
      passwordHash = user?.passwordHash;
    } else {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      passwordHash = user?.password;
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in correct table
    if (userType === 'admin') {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });
    }

    // Invalidate all sessions
    await this.cacheStrategy.invalidateUserCaches(userId);

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully. Please login again.' };
  }

  /**
   * Generate JWT access token with userType
   */
  private async generateAccessToken(
    userId: string,
    email: string,
    role: UserRole | AdminRole,
    userType: UserType,
  ): Promise<string> {
    const payload = {
      sub: userId,
      email,
      role,
      type: 'access',
      userType, // ← Add userType to JWT
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
    });
  }

  /**
   * Generate JWT refresh token with userType
   */
  private async generateRefreshToken(
    userId: string,
    userType: UserType,
  ): Promise<string> {
    const tokenId = `${userId}-${Date.now()}`;

    const payload = {
      sub: userId,
      jti: tokenId,
      type: 'refresh',
      userType, // ← Add userType to JWT
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
    });

    // Cache refresh token
    const tokenKey = CacheKeyBuilder.userRefreshToken(tokenId);
    await this.cacheStrategy.set(tokenKey, { valid: true }, 7 * 24 * 60 * 60);

    return token;
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, userType: UserType = 'user') {
    let user: any;

    if (userType === 'admin') {
      user = await this.prisma.adminUser.findUnique({ where: { email } });
    } else {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'password-reset', userType },
      { expiresIn: '1h' },
    );

    this.logger.log(`Password reset token generated for ${email}: ${resetToken}`);

    return {
      message: 'If the email exists, a reset link has been sent',
      token: resetToken, // Remove in production
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid reset token');
      }

      const userId = payload.sub;
      const userType: UserType = payload.userType || 'user';

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in correct table
      if (userType === 'admin') {
        await this.prisma.adminUser.update({
          where: { id: userId },
          data: { passwordHash: hashedPassword },
        });
      } else {
        await this.prisma.user.update({
          where: { id: userId },
          data: { passwordHash: hashedPassword },
        });
      }

      // Invalidate all sessions
      await this.cacheStrategy.invalidateUserCaches(userId);

      this.logger.log(`Password reset successful for user: ${userId}`);

      return {
        message: 'Password reset successful. Please login with your new password.',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  /**
   * Login with an existing user object (for OAuth)
   */
  async loginWithUser(user: any, userType: UserType) {
    // Generate tokens
    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
      userType,
    );
    const refreshToken = await this.generateRefreshToken(user.id, userType);

    // Cache user session
    const sessionKey = CacheKeyBuilder.userSession(user.id);
    await this.cacheStrategy.set(
      sessionKey,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType,
      },
      CACHE_TTL.USER_SESSION,
      false
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}