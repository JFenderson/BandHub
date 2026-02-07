import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * HTTPS Redirect Middleware
 * 
 * Forces all production traffic to use HTTPS by redirecting HTTP requests
 * to their HTTPS equivalent with a 301 (permanent redirect) status code.
 * 
 * Behavior:
 * - Production + HTTP + Not Health/Metrics: Redirect to HTTPS with 301
 * - Production + HTTPS: Pass through (no redirect)
 * - Production + Health/Metrics endpoints: Pass through (no redirect)
 * - Non-production: Always pass through (no redirect)
 * 
 * Security Benefits:
 * - Ensures all production traffic is encrypted
 * - Uses 301 redirect for better SEO and caching
 * - Prevents accidental exposure of sensitive data over HTTP
 * 
 * Health Check Exclusion:
 * - Excludes /api/health and /api/metrics to avoid monitoring issues
 * - Load balancers and monitoring tools often use HTTP for health checks
 */
@Injectable()
export class HttpsRedirectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpsRedirectMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Only enforce HTTPS in production
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    // Skip redirect for health check and metrics endpoints
    // These are often accessed by load balancers via HTTP
    const isHealthEndpoint = req.path === '/api/health' || req.path.startsWith('/api/health/');
    const isMetricsEndpoint = req.path === '/api/metrics' || req.path.startsWith('/api/metrics/');
    
    if (isHealthEndpoint || isMetricsEndpoint) {
      next();
      return;
    }

    // Check if request is already secure (HTTPS)
    if (req.secure) {
      next();
      return;
    }

    // Redirect HTTP to HTTPS
    const host = req.get('host');
    
    if (!host) {
      // If no host header, log warning and pass through
      this.logger.warn('HTTPS redirect skipped: Missing host header');
      next();
      return;
    }

    // Build HTTPS URL preserving path and query string
    const httpsUrl = `https://${host}${req.originalUrl || req.url}`;
    
    // Log redirect for debugging
    if (process.env.LOG_HTTPS_REDIRECTS === 'true') {
      this.logger.log(
        `HTTPS redirect: ${req.method} ${req.protocol}://${host}${req.url} -> ${httpsUrl} ` +
        `(IP: ${req.ip || req.socket?.remoteAddress || 'unknown'})`
      );
    }

    // Perform 301 permanent redirect
    res.redirect(301, httpsUrl);
  }
}
