import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MagicLinkService } from '../services/magic-link.service';
import { SecurityService } from '../services/security.service';
import { SessionService } from '../services/session.service';
import { DatabaseService } from '../../../database/database.service';

class CreateMagicLinkDto {
  @ApiProperty({
    description: 'Email address to send magic link to',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class RedeemMagicLinkDto {
  @ApiProperty({
    description: 'Magic link token from the email',
    example: 'abc123...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

@ApiTags('Magic Link Authentication')
@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(
    private readonly magicLinkService: MagicLinkService,
    private readonly securityService: SecurityService,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: DatabaseService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({ summary: 'Request a magic link for passwordless login' })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent if email exists (always returns success for security)',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async createMagicLink(
    @Body() dto: CreateMagicLinkDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<{
    message: string;
    expiresInMinutes: number;
  }> {
    try {
      const result = await this.magicLinkService.createMagicLink(
        dto.email.toLowerCase(),
        ipAddress,
        userAgent,
      );

      // Log the event
      await this.securityService.logMagicLinkCreated(
        result.linkId, // Using linkId as we may not have userId for non-existent emails
        dto.email,
        ipAddress,
      );

      // In production, send email here
      // await this.emailService.sendMagicLink(dto.email, result.magicLinkUrl);

      console.log(`Magic link created for ${dto.email}: ${result.magicLinkUrl}`);
    } catch {
      // Don't reveal if email exists or not
      // Log internally but return generic success message
    }

    // Always return success to prevent email enumeration
    return {
      message: 'If an account exists with this email, a magic link has been sent.',
      expiresInMinutes: this.magicLinkService.getExpiryMinutes(),
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a magic link token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
  })
  async verifyMagicLink(
    @Body() dto: RedeemMagicLinkDto,
  ): Promise<{
    isValid: boolean;
    email?: string;
    expiresAt?: Date;
  }> {
    return this.magicLinkService.validateToken(dto.token);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem a magic link and get access tokens' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired magic link',
  })
  async redeemMagicLink(
    @Body() dto: RedeemMagicLinkDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> {
    // Redeem the magic link
    const { userId, email } = await this.magicLinkService.redeemMagicLink(
      dto.token,
      ipAddress,
      userAgent,
    );

    // Get user details
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create a session
    const { sessionId } = await this.sessionService.createSession({
      userId,
      ipAddress,
      userAgent,
    });

    // Generate access token
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionId,
      },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    // Generate refresh token (simplified - in production use the full token rotation logic)
    const refreshToken = require('crypto').randomBytes(64).toString('hex');

    // Log the authentication
    await this.securityService.logMagicLinkUsed(userId, ipAddress, userAgent);
    await this.securityService.logLoginSuccess(userId, ipAddress, userAgent, sessionId);

    // Update last login
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
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
}
