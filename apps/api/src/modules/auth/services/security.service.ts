import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../../database/database.service';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REFRESH_TOKEN_USED'
  | 'REFRESH_REUSE_DETECTED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'MFA_FAILED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'MAGIC_LINK_CREATED'
  | 'MAGIC_LINK_USED'
  | 'OAUTH_LINKED'
  | 'OAUTH_UNLINKED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'SUSPICIOUS_LOGIN';

export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface LogSecurityEventOptions {
  eventType: SecurityEventType;
  userId?: string;
  severity?: SecurityEventSeverity;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: GeoLocation;
}

export interface SecurityEventFilter {
  userId?: string;
  eventTypes?: SecurityEventType[];
  severity?: SecurityEventSeverity;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SecurityService {
  private geoIpEnabled: boolean = false;

  constructor(
    private prisma: DatabaseService,
    private configService: ConfigService,
  ) {
    // Check if GeoIP is configured
    this.geoIpEnabled = !!this.configService.get<string>('GEOIP_API_KEY');
  }

  /**
   * Log a security event
   */
  async logEvent(options: LogSecurityEventOptions): Promise<void> {
    const {
      eventType,
      userId,
      severity = 'info',
      description,
      metadata,
      ipAddress,
      userAgent,
      geoLocation,
    } = options;

    // Optionally lookup geolocation if not provided
    let geo = geoLocation;
    if (!geo && ipAddress && this.geoIpEnabled) {
      geo = await this.lookupGeoLocation(ipAddress);
    }

    try {
      await this.prisma.securityEvent.create({
        data: {
          eventType,
          userId,
          severity,
          description,
          metadata: metadata || {},
          ipAddress,
          userAgent,
          country: geo?.country,
          region: geo?.region,
          city: geo?.city,
          latitude: geo?.latitude,
          longitude: geo?.longitude,
        },
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log login success
   */
  async logLoginSuccess(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'LOGIN_SUCCESS',
      userId,
      severity: 'info',
      description: 'User successfully logged in',
      metadata: { sessionId },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log login failure
   */
  async logLoginFailed(
    userId: string | undefined,
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'LOGIN_FAILED',
      userId,
      severity: 'warning',
      description: `Login failed: ${reason}`,
      metadata: { email, reason },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log refresh token reuse detection
   */
  async logRefreshReuseDetected(
    userId: string,
    tokenId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'REFRESH_REUSE_DETECTED',
      userId,
      severity: 'critical',
      description: 'Refresh token reuse detected - all sessions terminated',
      metadata: { tokenId },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log MFA enabled
   */
  async logMfaEnabled(userId: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      eventType: 'MFA_ENABLED',
      userId,
      severity: 'info',
      description: 'MFA enabled for account',
      ipAddress,
    });
  }

  /**
   * Log MFA disabled
   */
  async logMfaDisabled(userId: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      eventType: 'MFA_DISABLED',
      userId,
      severity: 'warning',
      description: 'MFA disabled for account',
      ipAddress,
    });
  }

  /**
   * Log MFA verification success
   */
  async logMfaVerified(userId: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      eventType: 'MFA_VERIFIED',
      userId,
      severity: 'info',
      description: 'MFA verification successful',
      ipAddress,
    });
  }

  /**
   * Log MFA verification failure
   */
  async logMfaFailed(userId: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      eventType: 'MFA_FAILED',
      userId,
      severity: 'warning',
      description: 'MFA verification failed',
      ipAddress,
    });
  }

  /**
   * Log password change
   */
  async logPasswordChanged(userId: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      eventType: 'PASSWORD_CHANGED',
      userId,
      severity: 'info',
      description: 'Password changed',
      ipAddress,
    });
  }

  /**
   * Log session revocation
   */
  async logSessionRevoked(
    userId: string,
    sessionId: string,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'SESSION_REVOKED',
      userId,
      severity: 'info',
      description: `Session revoked: ${reason}`,
      metadata: { sessionId, reason },
      ipAddress,
    });
  }

  /**
   * Log account lockout
   */
  async logAccountLocked(
    userId: string,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'ACCOUNT_LOCKED',
      userId,
      severity: 'warning',
      description: `Account locked: ${reason}`,
      metadata: { reason },
      ipAddress,
    });
  }

  /**
   * Log suspicious login
   */
  async logSuspiciousLogin(
    userId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
    geoLocation?: GeoLocation,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'SUSPICIOUS_LOGIN',
      userId,
      severity: 'warning',
      description: `Suspicious login detected: ${reason}`,
      metadata: { reason },
      ipAddress,
      userAgent,
      geoLocation,
    });
  }

  /**
   * Log magic link creation
   */
  async logMagicLinkCreated(
    userId: string,
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'MAGIC_LINK_CREATED',
      userId,
      severity: 'info',
      description: 'Magic link created',
      metadata: { email },
      ipAddress,
    });
  }

  /**
   * Log magic link usage
   */
  async logMagicLinkUsed(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'MAGIC_LINK_USED',
      userId,
      severity: 'info',
      description: 'Magic link used for authentication',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log OAuth account linking
   */
  async logOAuthLinked(
    userId: string,
    provider: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'OAUTH_LINKED',
      userId,
      severity: 'info',
      description: `OAuth account linked: ${provider}`,
      metadata: { provider },
      ipAddress,
    });
  }

  /**
   * Get security events with filtering
   */
  async getEvents(filter: SecurityEventFilter): Promise<{
    events: any[];
    total: number;
  }> {
    const where: any = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.eventTypes?.length) {
      where.eventType = { in: filter.eventTypes };
    }

    if (filter.severity) {
      where.severity = filter.severity;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    if (filter.ipAddress) {
      where.ipAddress = filter.ipAddress;
    }

    const [events, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.securityEvent.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Get recent events for a user
   */
  async getRecentEventsForUser(
    userId: string,
    limit: number = 10,
  ): Promise<any[]> {
    return this.prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Lookup geolocation for an IP address
   * This is a placeholder - integrate with a GeoIP provider like MaxMind or IPinfo
   */
  private async lookupGeoLocation(ipAddress: string): Promise<GeoLocation | undefined> {
    // Skip for localhost/private IPs
    if (
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('172.')
    ) {
      return undefined;
    }

    const apiKey = this.configService.get<string>('GEOIP_API_KEY');
    const provider = this.configService.get<string>('GEOIP_PROVIDER') || 'ipinfo';

    if (!apiKey) {
      return undefined;
    }

    try {
      if (provider === 'ipinfo') {
        // IPinfo.io integration
        const response = await fetch(
          `https://ipinfo.io/${ipAddress}?token=${apiKey}`,
        );
        if (response.ok) {
          const data = await response.json();
          const [lat, lon] = (data.loc || '').split(',').map(Number);
          return {
            country: data.country,
            region: data.region,
            city: data.city,
            latitude: lat || undefined,
            longitude: lon || undefined,
          };
        }
      }
      // Add more providers as needed
    } catch (error) {
      console.error('GeoIP lookup failed:', error);
    }

    return undefined;
  }

  /**
   * Check for suspicious login patterns
   */
  async checkForSuspiciousActivity(
    userId: string,
    ipAddress?: string,
    deviceFingerprint?: string,
    geoLocation?: GeoLocation,
  ): Promise<{ isSuspicious: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Get recent successful logins
    const recentLogins = await this.prisma.securityEvent.findMany({
      where: {
        userId,
        eventType: 'LOGIN_SUCCESS',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Check for new IP address
    if (ipAddress && recentLogins.length > 0) {
      const knownIps = new Set(recentLogins.map((l) => l.ipAddress).filter(Boolean));
      if (!knownIps.has(ipAddress)) {
        reasons.push('New IP address');
      }
    }

    // Check for geolocation jump (impossible travel)
    if (geoLocation && recentLogins.length > 0) {
      const lastLogin = recentLogins[0];
      if (
        lastLogin.latitude &&
        lastLogin.longitude &&
        geoLocation.latitude &&
        geoLocation.longitude
      ) {
        const distance = this.calculateDistance(
          lastLogin.latitude,
          lastLogin.longitude,
          geoLocation.latitude,
          geoLocation.longitude,
        );

        const timeDiff =
          (Date.now() - lastLogin.createdAt.getTime()) / (1000 * 60 * 60); // hours
        const maxPossibleDistance = timeDiff * 900; // Assume max 900 km/h (jet speed)

        if (distance > maxPossibleDistance) {
          reasons.push('Impossible travel detected');
        }
      }
    }

    // Check for new country
    if (geoLocation?.country && recentLogins.length > 0) {
      const knownCountries = new Set(
        recentLogins.map((l) => l.country).filter(Boolean),
      );
      if (knownCountries.size > 0 && !knownCountries.has(geoLocation.country)) {
        reasons.push('New country');
      }
    }

    // Check for multiple failed attempts before success
    const recentFailures = await this.prisma.securityEvent.count({
      where: {
        userId,
        eventType: 'LOGIN_FAILED',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 minutes
      },
    });

    if (recentFailures >= 3) {
      reasons.push('Multiple failed login attempts');
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
