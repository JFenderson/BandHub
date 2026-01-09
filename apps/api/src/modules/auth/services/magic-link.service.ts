import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@bandhub/database';
import * as crypto from 'crypto';

export interface MagicLinkResult {
  linkId: string;
  token: string;
  expiresAt: Date;
  magicLinkUrl: string;
}

@Injectable()
export class MagicLinkService {
  private readonly LINK_EXPIRY_MINUTES = 15;
  private readonly MAX_ACTIVE_LINKS_PER_USER = 3;
  private readonly RATE_LIMIT_MINUTES = 1; // Minimum time between link requests

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Create a magic link for passwordless authentication
   */
  async createMagicLink(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MagicLinkResult> {
    // Find user by email
    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (!user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    // Check rate limiting
    const recentLink = await this.prisma.magicLink.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - this.RATE_LIMIT_MINUTES * 60 * 1000),
        },
      },
    });

    if (recentLink) {
      throw new BadRequestException(
        `Please wait ${this.RATE_LIMIT_MINUTES} minute(s) before requesting another magic link`,
      );
    }

    // Clean up old unused links
    await this.cleanupUserLinks(user.id);

    // Check max active links
    const activeLinks = await this.prisma.magicLink.count({
      where: {
        userId: user.id,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeLinks >= this.MAX_ACTIVE_LINKS_PER_USER) {
      // Invalidate oldest link
      const oldestLink = await this.prisma.magicLink.findFirst({
        where: {
          userId: user.id,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (oldestLink) {
        await this.prisma.magicLink.update({
          where: { id: oldestLink.id },
          data: { isUsed: true, usedAt: new Date() },
        });
      }
    }

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.LINK_EXPIRY_MINUTES);

    // Create magic link record
    const magicLink = await this.prisma.magicLink.create({
      data: {
        token: hashedToken,
        userId: user.id,
        email: user.email,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Build the magic link URL
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${rawToken}`;

    return {
      linkId: magicLink.id,
      token: rawToken,
      expiresAt,
      magicLinkUrl,
    };
  }

  /**
   * Verify and redeem a magic link token
   */
  async redeemMagicLink(
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    userId: string;
    email: string;
  }> {
    const hashedToken = this.hashToken(token);

    // Find the magic link
    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!magicLink) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }

    // Check if already used
    if (magicLink.isUsed) {
      throw new UnauthorizedException('This magic link has already been used');
    }

    // Check if expired
    if (magicLink.expiresAt < new Date()) {
      throw new UnauthorizedException('This magic link has expired');
    }

    // Check if user is still active
    if (!magicLink.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Mark as used
    await this.prisma.magicLink.update({
      where: { id: magicLink.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return {
      userId: magicLink.userId,
      email: magicLink.email,
    };
  }

  /**
   * Check if a token is valid without consuming it
   */
  async validateToken(token: string): Promise<{
    isValid: boolean;
    expiresAt?: Date;
    email?: string;
  }> {
    const hashedToken = this.hashToken(token);

    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token: hashedToken },
    });

    if (!magicLink) {
      return { isValid: false };
    }

    if (magicLink.isUsed || magicLink.expiresAt < new Date()) {
      return { isValid: false };
    }

    return {
      isValid: true,
      expiresAt: magicLink.expiresAt,
      email: magicLink.email,
    };
  }

  /**
   * Revoke all magic links for a user
   */
  async revokeAllUserLinks(userId: string): Promise<number> {
    const result = await this.prisma.magicLink.updateMany({
      where: {
        userId,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Clean up expired and old links
   */
  async cleanupExpiredLinks(): Promise<number> {
    const result = await this.prisma.magicLink.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isUsed: true, usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    return result.count;
  }

  /**
   * Clean up links for a specific user
   */
  private async cleanupUserLinks(userId: string): Promise<void> {
    await this.prisma.magicLink.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get magic link expiry time in minutes
   */
  getExpiryMinutes(): number {
    return this.LINK_EXPIRY_MINUTES;
  }
}
