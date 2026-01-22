/**
 * Security Configuration
 * 
 * Centralized security headers and Content Security Policy configuration.
 * Implements comprehensive security headers including CSP, HSTS, and frame protection.
 */

export interface SecurityConfig {
  contentSecurityPolicy: {
    directives: Record<string, string[] | boolean>;
  };
  strictTransportSecurity: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  frameOptions: 'DENY' | 'SAMEORIGIN';
  contentTypeOptions: boolean;
  dnsPrefetchControl: boolean;
  reportingEndpoint?: string;
}

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(env: string = 'development'): SecurityConfig {
  const isProduction = env === 'production';
  
  // Base CSP directives
  const baseCsp = {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      ...(isProduction ? [] : ["'unsafe-inline'", "'unsafe-eval'"]), // Allow inline scripts in dev
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for many CSS frameworks
    ],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://i.ytimg.com', // YouTube thumbnails
      'https://img.youtube.com', // YouTube images
      'https://yt3.ggpht.com', // YouTube channel avatars
      ...(isProduction ? [] : ['http://localhost:*']), // Allow localhost images in dev
    ],
    mediaSrc: [
      "'self'",
      'https://www.youtube.com',
      'https://youtube.com',
    ],
    frameSrc: [
      "'self'",
      'https://www.youtube.com', // YouTube embeds
      'https://youtube.com',
    ],
    connectSrc: [
      "'self'",
      'https://www.googleapis.com', // YouTube API
      'https://youtube.googleapis.com',
      ...(isProduction ? [] : ['http://localhost:*', 'ws://localhost:*']), // Allow localhost API calls and WebSocket in dev
    ],
    fontSrc: [
      "'self'",
      'data:',
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    upgradeInsecureRequests: isProduction ? [] : false, // Only upgrade in production
  };

  return {
    contentSecurityPolicy: {
      directives: baseCsp,
    },
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: isProduction, // Only preload in production
    },
    frameOptions: 'SAMEORIGIN',
    contentTypeOptions: true,
    dnsPrefetchControl: true,
    reportingEndpoint: '/api/csp-report',
  };
}

/**
 * Convert CSP directives object to CSP header string
 */
export function buildCspHeader(directives: Record<string, string[] | boolean>): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      
      if (typeof value === 'boolean') {
        return value ? directive : '';
      }
      
      if (Array.isArray(value) && value.length > 0) {
        return `${directive} ${value.join(' ')}`;
      }
      
      return '';
    })
    .filter(Boolean)
    .join('; ');
}
