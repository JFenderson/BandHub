import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import * as crypto from 'crypto';

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  isActive: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
  isCurrent?: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  expiresInDays?: number;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class SessionService {
  private readonly DEFAULT_SESSION_EXPIRY_DAYS = 30;

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new session for a user
   */
  async createSession(options: CreateSessionOptions): Promise<{
    sessionId: string;
    tokenChainId: string;
  }> {
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (options.expiresInDays || this.DEFAULT_SESSION_EXPIRY_DAYS),
    );

    // Generate a unique token chain ID for tracking token rotation
    const tokenChainId = crypto.randomBytes(32).toString('hex');

    // Parse user agent for device info
    const deviceInfo = this.parseUserAgent(options.userAgent);

    // Create the session
    const session = await this.prisma.adminSession.create({
      data: {
        userId: options.userId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceFingerprint: options.deviceFingerprint,
        expiresAt,
        tokenChainId,
        isActive: true,
      },
    });

    return {
      sessionId: session.id,
      tokenChainId,
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionInfo[]> {
    const sessions = await this.prisma.adminSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      country: session.country,
      city: session.city,
      isActive: session.isActive,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    reason: string = 'manual',
  ): Promise<void> {
    const session = await this.prisma.adminSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Revoke the session
    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Revoke all refresh tokens associated with this session
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'session_revoked',
      },
    });
  }

  /**
   * Revoke all sessions for a user except the current one
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<number> {
    const whereClause: any = {
      userId,
      isActive: true,
    };

    if (currentSessionId) {
      whereClause.id = { not: currentSessionId };
    }

    const result = await this.prisma.adminSession.updateMany({
      where: whereClause,
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'logout_all',
      },
    });

    // Revoke associated refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        sessionId: currentSessionId ? { not: currentSessionId } : undefined,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'logout_all',
      },
    });

    return result.count;
  }

  /**
   * Revoke all sessions for a user (including current)
   */
  async revokeAllSessions(userId: string, reason: string = 'security'): Promise<number> {
    const result = await this.prisma.adminSession.updateMany({
      where: { userId, isActive: true },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    return result.count;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  /**
   * Update session with geolocation data
   */
  async updateSessionGeoLocation(
    sessionId: string,
    geoLocation: GeoLocation,
  ): Promise<void> {
    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: {
        country: geoLocation.country,
        region: geoLocation.region,
        city: geoLocation.city,
        latitude: geoLocation.latitude,
        longitude: geoLocation.longitude,
      },
    });
  }

  /**
   * Check if a session is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.prisma.adminSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return false;
    if (!session.isActive) return false;
    if (session.expiresAt < new Date()) return false;

    return true;
  }

  /**
   * Get session by token chain ID
   */
  async getSessionByTokenChain(tokenChainId: string): Promise<any> {
    return this.prisma.adminSession.findFirst({
      where: { tokenChainId, isActive: true },
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.adminSession.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'expired',
      },
    });

    return result.count;
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
    } else if (/msie|trident/i.test(userAgent)) {
      browser = 'Internet Explorer';
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
}
