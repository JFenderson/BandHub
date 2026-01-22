/**
 * Security Headers Middleware
 * 
 * Applies comprehensive security headers to all responses:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-DNS-Prefetch-Control
 * 
 * Uses helmet-like functionality without external dependency.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getSecurityConfig, buildCspHeader } from '../../config/security.config';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly config = getSecurityConfig(process.env.NODE_ENV);

  use(req: Request, res: Response, next: NextFunction) {
    // Content Security Policy
    const cspHeader = buildCspHeader(this.config.contentSecurityPolicy.directives);
    if (cspHeader) {
      res.setHeader('Content-Security-Policy', cspHeader);
      
      // Also set report-only header for monitoring in production
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
      }
    }

    // HTTP Strict Transport Security (only in production with HTTPS)
    if (process.env.NODE_ENV === 'production') {
      const hsts = this.config.strictTransportSecurity;
      let hstsValue = `max-age=${hsts.maxAge}`;
      
      if (hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      
      if (hsts.preload) {
        hstsValue += '; preload';
      }
      
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    res.setHeader('X-Frame-Options', this.config.frameOptions);

    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-DNS-Prefetch-Control
    if (this.config.dnsPrefetchControl) {
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    // X-Download-Options (IE8+)
    res.setHeader('X-Download-Options', 'noopen');

    // X-Permitted-Cross-Domain-Policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // X-XSS-Protection (legacy, but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    next();
  }
}
