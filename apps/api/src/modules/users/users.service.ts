import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto, UserLoginResponseDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PrismaService} from '@bandhub/database';

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly SESSION_EXPIRY_DAYS = 7;
  private readonly REMEMBER_ME_EXPIRY_DAYS = 30;
  private readonly VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
  private readonly RESET_TOKEN_EXPIRY_HOURS = 1;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterUserDto) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        preferences: {
          theme: 'auto',
          defaultVideoSort: 'recent',
          preferredCategories: [],
          emailNotifications: {
            newContent: true,
            favorites: true,
            newsletter: true,
          },
          favoriteBands: [],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Create email verification token
    const verificationToken = await this.createVerificationToken(user.id);

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Login user and return tokens
   */
  async login(
    loginDto: LoginUserDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserLoginResponseDto> {
    const { email, password, rememberMe } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const sessionToken = await this.createSession(
      user.id,
      rememberMe || false,
      ipAddress,
      userAgent,
    );

    const expiryDays = rememberMe ? this.REMEMBER_ME_EXPIRY_DAYS : this.SESSION_EXPIRY_DAYS;

    return {
      accessToken,
      sessionToken,
      expiresIn: expiryDays * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
    };
  }

  /**
   * Logout user by invalidating session
   */
  async logout(sessionToken: string, userId: string): Promise<void> {
    const hashedToken = this.hashToken(sessionToken);

    await this.prisma.userSession.deleteMany({
      where: {
        token: hashedToken,
        userId,
      },
    });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        preferences: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build update data
    const updateData: {
      name?: string;
      avatar?: string | null;
      bio?: string | null;
      preferences?: object;
    } = {};

    if (updateDto.name) {
      updateData.name = updateDto.name;
    }
    if (updateDto.avatar !== undefined) {
      updateData.avatar = updateDto.avatar;
    }
    if (updateDto.bio !== undefined) {
      updateData.bio = updateDto.bio;
    }
    if (updateDto.preferences) {
      updateData.preferences = {
        ...(user.preferences as object),
        ...updateDto.preferences,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        preferences: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    // Update password and invalidate all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.userSession.deleteMany({
        where: { userId },
      }),
    ]);

    // Send password changed email
    await this.emailService.sendPasswordChangedEmail(user.email, user.name);
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user (cascades to all related records)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Send account deleted email
    await this.emailService.sendAccountDeletedEmail(user.email, user.name);
  }

  /**
   * Request password reset
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return;
    }

    // Delete existing reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.RESET_TOKEN_EXPIRY_HOURS);

    await this.prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(user.email, user.name, token);
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, password } = resetPasswordDto;

    const hashedToken = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.used) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Update password, mark token as used, and invalidate all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      this.prisma.userSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    // Send password changed email
    await this.emailService.sendPasswordChangedEmail(resetToken.user.email, resetToken.user.name);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const hashedToken = this.hashToken(token);

    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Update user and delete token
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);
  }

  /**
   * Resend verification email
   */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Delete existing verification tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new verification token
    const verificationToken = await this.createVerificationToken(user.id);

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, user.name, verificationToken);
  }

  /**
   * Get all user sessions
   */
  async getSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: {
        id: true,
        deviceType: true,
        browser: true,
        ipAddress: true,
        lastActiveAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions;
  }

  /**
   * Delete specific session
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Validate session token
   */
  async validateSession(token: string) {
    const hashedToken = this.hashToken(token);

    const session = await this.prisma.userSession.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.userSession.delete({
        where: { id: session.id },
      });
      throw new UnauthorizedException('Session expired');
    }

    // Update last active
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return session.user;
  }

  // ============ PRIVATE HELPER METHODS ============

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: { id: string; email: string }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'user',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Create user session
   */
  private async createSession(
    userId: string,
    rememberMe: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const hashedToken = this.hashToken(token);

    const expiresAt = new Date();
    const expiryDays = rememberMe ? this.REMEMBER_ME_EXPIRY_DAYS : this.SESSION_EXPIRY_DAYS;
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Parse user agent for device info
    const deviceInfo = this.parseUserAgent(userAgent);

    await this.prisma.userSession.create({
      data: {
        userId,
        token: hashedToken,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        ipAddress,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Create email verification token
   */
  private async createVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.VERIFICATION_TOKEN_EXPIRY_HOURS);

    await this.prisma.emailVerificationToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse user agent string
   */
  private parseUserAgent(userAgent?: string): { deviceType: string; browser: string } {
    if (!userAgent) {
      return { deviceType: 'Unknown', browser: 'Unknown' };
    }

    let deviceType = 'Desktop';
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      deviceType = /iPad|Tablet/i.test(userAgent) ? 'Tablet' : 'Mobile';
    }

    let browser = 'Unknown';
    if (/Chrome/i.test(userAgent) && !/Edge|Edg/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/Firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/Edge|Edg/i.test(userAgent)) {
      browser = 'Edge';
    } else if (/MSIE|Trident/i.test(userAgent)) {
      browser = 'Internet Explorer';
    }

    return { deviceType, browser };
  }

  /**
   * Clean up expired sessions (call periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Clean up expired tokens (call periodically)
   */
  async cleanupExpiredTokens(): Promise<{ verification: number; reset: number }> {
    const [verification, reset] = await Promise.all([
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true },
          ],
        },
      }),
    ]);

    return {
      verification: verification.count,
      reset: reset.count,
    };
  }
}
