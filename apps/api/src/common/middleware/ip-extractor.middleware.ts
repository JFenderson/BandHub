/**
 * IP Extractor Middleware
 * 
 * Extracts the real IP address from request headers when behind proxies/CDNs.
 * This is critical for accurate rate limiting when deployed behind:
 * - Reverse proxies (Nginx, Apache)
 * - Load balancers (AWS ELB, GCP Load Balancer)
 * - CDNs (Cloudflare, Fastly)
 * 
 * The middleware checks common headers in priority order and sets
 * a normalized IP on the request object.
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Extended Request interface with real IP
 */
export interface RequestWithIp extends Request {
  realIp?: string;
}

@Injectable()
export class IpExtractorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpExtractorMiddleware.name);

  /**
   * Priority order of headers to check for real IP
   * Different proxies/CDNs use different headers
   */
  private readonly IP_HEADERS = [
    'cf-connecting-ip', // Cloudflare
    'true-client-ip', // Cloudflare Enterprise
    'x-real-ip', // Nginx proxy
    'x-forwarded-for', // Standard proxy header
    'x-client-ip', // Some proxies
    'x-cluster-client-ip', // Rackspace LB
    'forwarded-for', // RFC 7239
    'forwarded', // RFC 7239
  ];

use(req: RequestWithIp, res: Response, next: NextFunction) {
  const realIp = this.extractRealIp(req);
  req.realIp = realIp;

  // CHANGE THIS - always log, not just in development
  this.logger.debug(`🟢 IpExtractorMiddleware: IP=${realIp}, path=${req.path}`);
  console.log(`🟢 IpExtractorMiddleware: IP=${realIp}, path=${req.path}`);

  next();
}
  /**
   * Extract the real IP address from request headers
   * Handles various proxy scenarios and header formats
   */
  private extractRealIp(req: Request): string {
    // Check each header in priority order
    for (const header of this.IP_HEADERS) {
      const value = req.headers[header];
      if (value) {
        const ip = this.parseIpFromHeader(value as string);
        if (ip) {
          return this.normalizeIp(ip);
        }
      }
    }

    // Fallback to Express's req.ip (derived from connection)
    // This works for direct connections without proxies
    const fallbackIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
    return this.normalizeIp(fallbackIp);
  }

  /**
   * Parse IP from header value
   * Handles comma-separated lists (X-Forwarded-For can have multiple IPs)
   */
  private parseIpFromHeader(headerValue: string): string | null {
    if (!headerValue) {
      return null;
    }

    // X-Forwarded-For format: "client, proxy1, proxy2"
    // We want the leftmost (client) IP
    const ips = headerValue.split(',').map(ip => ip.trim());
    
    // Return the first non-private IP if available
    for (const ip of ips) {
      if (this.isValidIp(ip) && !this.isPrivateIp(ip)) {
        return ip;
      }
    }

    // If all IPs are private, return the first one
    // This handles internal network scenarios
    return ips[0] || null;
  }

  /**
   * Normalize IP address
   * - Remove IPv6 prefix from IPv4-mapped addresses (::ffff:192.168.1.1 -> 192.168.1.1)
   * - Trim whitespace
   */
  private normalizeIp(ip: string): string {
    let normalized = ip.trim();

    // Remove IPv6 prefix from IPv4-mapped addresses
    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.substring(7);
    }

    return normalized;
  }

  /**
   * Basic IP validation
   * Checks if the string looks like a valid IPv4 or IPv6 address
   */
  private isValidIp(ip: string): boolean {
    // IPv4 regex (simple check)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    // IPv6 regex (simple check)
    const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is in private range
   * Private IPs shouldn't be used for rate limiting in production
   * as they represent internal network addresses
   */
  private isPrivateIp(ip: string): boolean {
    // IPv4 private ranges
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^127\./, // 127.0.0.0/8 (loopback)
    ];

    // Check if IP matches any private range
    return privateRanges.some(range => range.test(ip));
  }
}