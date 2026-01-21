import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Version Deprecation Middleware
 * 
 * Monitors API version usage and emits warnings when deprecated versions are accessed.
 * Helps track adoption of new versions and plan for old version removal.
 * 
 * Deprecation Policy:
 * - Warning phase: 3 months (Deprecation-Warning header added)
 * - Sunset phase: 3 months (Sunset header with removal date)
 * - Total backward compatibility: 6 months
 */
@Injectable()
export class VersionDeprecationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(VersionDeprecationMiddleware.name);

  // Define deprecated versions with their sunset dates
  private readonly deprecatedVersions: Map<string, DeprecationInfo> = new Map([
    // Example: When v2 is released, v1 would be deprecated
    // ['v1', {
    //   deprecationDate: new Date('2026-01-21'),
    //   sunsetDate: new Date('2026-07-21'),
    //   replacementVersion: 'v2',
    //   message: 'API v1 is deprecated. Please migrate to v2. See /api/docs for migration guide.'
    // }]
  ]);

  // Track version usage for analytics
  private readonly versionUsageStats = new Map<string, number>();

  use(req: Request, res: Response, next: NextFunction) {
    const apiVersion = this.extractVersion(req.path);

    if (!apiVersion) {
      next();
      return;
    }

    // Track version usage
    this.trackVersionUsage(apiVersion);

    // Check if version is deprecated
    const deprecationInfo = this.deprecatedVersions.get(apiVersion);
    if (deprecationInfo) {
      this.handleDeprecatedVersion(req, res, deprecationInfo, apiVersion);
    }

    next();
  }

  /**
   * Extract API version from request path
   * Supports formats: /api/v1/..., /api/v2/...
   */
  private extractVersion(path: string): string | null {
    const versionMatch = path.match(/^\/api\/(v\d+)\//);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Track version usage for monitoring
   */
  private trackVersionUsage(version: string) {
    const currentCount = this.versionUsageStats.get(version) || 0;
    this.versionUsageStats.set(version, currentCount + 1);

    // Log usage statistics every 1000 requests
    if (currentCount % 1000 === 0 && currentCount > 0) {
      this.logger.log(`Version ${version} usage: ${currentCount} requests`);
    }
  }

  /**
   * Handle requests to deprecated API versions
   */
  private handleDeprecatedVersion(
    req: Request,
    res: Response,
    info: DeprecationInfo,
    version: string,
  ) {
    const now = new Date();
    const daysUntilSunset = Math.ceil(
      (info.sunsetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Add deprecation warning header
    res.setHeader(
      'Deprecation',
      `version="${version}"; date="${info.deprecationDate.toISOString()}"`,
    );

    // Add sunset header with removal date
    res.setHeader('Sunset', info.sunsetDate.toUTCString());

    // Add link to migration guide
    res.setHeader(
      'Link',
      '</api/docs>; rel="deprecation"; type="text/html"',
    );

    // Add custom warning message header
    res.setHeader('X-API-Deprecation-Warning', info.message);

    // Add replacement version header
    if (info.replacementVersion) {
      res.setHeader('X-API-Replacement-Version', info.replacementVersion);
    }

    // Log deprecation warning (only log occasionally to avoid spam)
    if (Math.random() < 0.01) {
      // Log 1% of requests
      this.logger.warn(
        `Deprecated API version ${version} accessed: ${req.method} ${req.path} ` +
          `(${daysUntilSunset} days until sunset) - ` +
          `User-Agent: ${req.get('User-Agent') || 'unknown'}`,
      );
    }

    // If sunset date has passed, log error and consider blocking
    if (now > info.sunsetDate) {
      this.logger.error(
        `SUNSET API version ${version} still being accessed: ${req.method} ${req.path}`,
      );
      // Optionally, you can block access after sunset date:
      // res.status(410).json({
      //   error: 'Gone',
      //   message: `API ${version} has been removed. Please use ${info.replacementVersion}.`,
      //   sunsetDate: info.sunsetDate.toISOString(),
      // });
    }
  }

  /**
   * Get version usage statistics (useful for admin dashboard)
   */
  getVersionStats(): Record<string, number> {
    return Object.fromEntries(this.versionUsageStats);
  }

  /**
   * Register a new deprecated version
   */
  registerDeprecatedVersion(version: string, info: DeprecationInfo) {
    this.deprecatedVersions.set(version, info);
    this.logger.log(
      `Registered deprecated version ${version}, sunset date: ${info.sunsetDate.toISOString()}`,
    );
  }

  /**
   * Remove a version from deprecation list (no longer supported)
   */
  removeDeprecatedVersion(version: string) {
    this.deprecatedVersions.delete(version);
    this.logger.log(`Removed deprecated version ${version} from tracking`);
  }
}

/**
 * Deprecation information for an API version
 */
export interface DeprecationInfo {
  /** Date when deprecation was announced */
  deprecationDate: Date;

  /** Date when version will be removed (sunset) */
  sunsetDate: Date;

  /** Version users should migrate to */
  replacementVersion?: string;

  /** Custom deprecation message */
  message: string;
}
