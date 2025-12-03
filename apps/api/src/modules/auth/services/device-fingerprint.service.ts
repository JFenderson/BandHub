import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DeviceFingerprintData {
  userAgent?: string;
  acceptLanguage?: string;
  timezone?: string;
  screenResolution?: string;
  colorDepth?: string;
  platform?: string;
  canvasHash?: string;
  webglRenderer?: string;
  plugins?: string[];
}

export interface DeviceInfo {
  fingerprint: string;
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  isMobile: boolean;
  isBot: boolean;
}

@Injectable()
export class DeviceFingerprintService {
  /**
   * Generate a device fingerprint from available data
   * This is a privacy-conscious implementation that uses hashing
   */
  generateFingerprint(data: DeviceFingerprintData): string {
    // Build fingerprint components
    const components: string[] = [];

    if (data.userAgent) {
      // Don't store raw user agent, extract normalized info
      const ua = this.parseUserAgent(data.userAgent);
      components.push(`browser:${ua.browser}:${ua.browserVersion}`);
      components.push(`os:${ua.os}:${ua.osVersion}`);
      components.push(`platform:${ua.platform}`);
    }

    if (data.acceptLanguage) {
      // Only use primary language
      const primaryLang = data.acceptLanguage.split(',')[0]?.split('-')[0] || 'unknown';
      components.push(`lang:${primaryLang}`);
    }

    if (data.timezone) {
      components.push(`tz:${data.timezone}`);
    }

    if (data.screenResolution) {
      components.push(`screen:${data.screenResolution}`);
    }

    if (data.colorDepth) {
      components.push(`colors:${data.colorDepth}`);
    }

    if (data.canvasHash) {
      components.push(`canvas:${data.canvasHash}`);
    }

    if (data.webglRenderer) {
      // Normalize WebGL renderer info
      const normalizedRenderer = data.webglRenderer
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 50);
      components.push(`webgl:${normalizedRenderer}`);
    }

    // Create hash from components
    const fingerprintData = components.sort().join('|');
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex')
      .slice(0, 32); // Use first 32 chars for storage efficiency

    return fingerprint;
  }

  /**
   * Generate a simple fingerprint from server-side data only
   */
  generateServerFingerprint(
    ipAddress?: string,
    userAgent?: string,
    acceptLanguage?: string,
  ): string {
    const components: string[] = [];

    if (userAgent) {
      const ua = this.parseUserAgent(userAgent);
      components.push(`${ua.browser}:${ua.os}:${ua.platform}`);
    }

    if (acceptLanguage) {
      const primaryLang = acceptLanguage.split(',')[0]?.split('-')[0] || 'unknown';
      components.push(primaryLang);
    }

    // Note: We intentionally don't include IP address in the fingerprint
    // as it can change frequently (mobile networks, VPNs, etc.)

    if (components.length === 0) {
      components.push('unknown');
    }

    const fingerprintData = components.join('|');
    return crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Parse user agent string to extract device information
   */
  parseUserAgent(userAgent: string): {
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    platform: string;
    deviceType: string;
    isMobile: boolean;
    isBot: boolean;
  } {
    const ua = userAgent.toLowerCase();

    // Detect bots
    const isBot =
      /bot|crawler|spider|scraper|curl|wget|postman|insomnia/i.test(userAgent);

    // Detect mobile
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(
      userAgent,
    );

    // Detect device type
    let deviceType = 'desktop';
    if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
      deviceType = 'tablet';
    } else if (isMobile) {
      deviceType = 'mobile';
    }

    // Detect browser and version
    let browser = 'unknown';
    let browserVersion = '';

    if (/edg\//i.test(userAgent)) {
      browser = 'edge';
      browserVersion = this.extractVersion(userAgent, /edg\/(\d+(?:\.\d+)*)/i);
    } else if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) {
      browser = 'chrome';
      browserVersion = this.extractVersion(userAgent, /chrome\/(\d+(?:\.\d+)*)/i);
    } else if (/firefox/i.test(userAgent)) {
      browser = 'firefox';
      browserVersion = this.extractVersion(userAgent, /firefox\/(\d+(?:\.\d+)*)/i);
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = 'safari';
      browserVersion = this.extractVersion(userAgent, /version\/(\d+(?:\.\d+)*)/i);
    } else if (/msie|trident/i.test(userAgent)) {
      browser = 'ie';
      browserVersion = this.extractVersion(userAgent, /(?:msie |rv:)(\d+(?:\.\d+)*)/i);
    }

    // Detect OS and version
    let os = 'unknown';
    let osVersion = '';
    let platform = 'unknown';

    if (/windows/i.test(userAgent)) {
      os = 'windows';
      platform = 'windows';
      if (/windows nt 10/i.test(userAgent)) osVersion = '10';
      else if (/windows nt 6\.3/i.test(userAgent)) osVersion = '8.1';
      else if (/windows nt 6\.2/i.test(userAgent)) osVersion = '8';
      else if (/windows nt 6\.1/i.test(userAgent)) osVersion = '7';
    } else if (/macintosh|mac os/i.test(userAgent)) {
      os = 'macos';
      platform = 'mac';
      osVersion = this.extractVersion(userAgent, /mac os x (\d+[._]\d+(?:[._]\d+)?)/i);
    } else if (/android/i.test(userAgent)) {
      os = 'android';
      platform = 'android';
      osVersion = this.extractVersion(userAgent, /android (\d+(?:\.\d+)*)/i);
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      os = 'ios';
      platform = 'ios';
      osVersion = this.extractVersion(userAgent, /os (\d+[._]\d+(?:[._]\d+)?)/i);
    } else if (/linux/i.test(userAgent)) {
      os = 'linux';
      platform = 'linux';
    }

    return {
      browser,
      browserVersion: browserVersion.split('.')[0] || '', // Major version only
      os,
      osVersion: osVersion.replace(/_/g, '.').split('.')[0] || '', // Major version only
      platform,
      deviceType,
      isMobile,
      isBot,
    };
  }

  /**
   * Get full device info from fingerprint data
   */
  getDeviceInfo(data: DeviceFingerprintData): DeviceInfo {
    const fingerprint = this.generateFingerprint(data);
    const ua = this.parseUserAgent(data.userAgent || '');

    return {
      fingerprint,
      deviceType: ua.deviceType,
      browser: ua.browser,
      browserVersion: ua.browserVersion,
      os: ua.os,
      osVersion: ua.osVersion,
      isMobile: ua.isMobile,
      isBot: ua.isBot,
    };
  }

  /**
   * Compare two fingerprints and return similarity score (0-1)
   */
  compareFingerprintSimilarity(fp1: string, fp2: string): number {
    if (fp1 === fp2) return 1.0;
    if (!fp1 || !fp2) return 0;

    // Simple character-based similarity for now
    // In production, you might want more sophisticated comparison
    let matches = 0;
    const len = Math.min(fp1.length, fp2.length);

    for (let i = 0; i < len; i++) {
      if (fp1[i] === fp2[i]) matches++;
    }

    return matches / len;
  }

  /**
   * Check if a fingerprint is suspicious (bot, unusual patterns)
   */
  isSuspiciousFingerprint(data: DeviceFingerprintData): {
    isSuspicious: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (data.userAgent) {
      const ua = this.parseUserAgent(data.userAgent);

      // Check for bots
      if (ua.isBot) {
        reasons.push('Bot user agent detected');
      }

      // Check for headless browsers
      if (/headless/i.test(data.userAgent)) {
        reasons.push('Headless browser detected');
      }

      // Check for automation tools
      if (/selenium|puppeteer|playwright|webdriver/i.test(data.userAgent)) {
        reasons.push('Automation tool detected');
      }
    }

    // Check for missing common fingerprint data
    if (!data.userAgent) {
      reasons.push('Missing user agent');
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Extract version from user agent string
   */
  private extractVersion(userAgent: string, regex: RegExp): string {
    const match = userAgent.match(regex);
    return match ? match[1] : '';
  }

  /**
   * Privacy documentation for device fingerprinting
   */
  getPrivacyInfo(): {
    dataCollected: string[];
    purpose: string;
    retention: string;
  } {
    return {
      dataCollected: [
        'Browser name and major version',
        'Operating system and major version',
        'Device type (desktop/mobile/tablet)',
        'Primary language preference',
        'Timezone',
        'Screen resolution (if provided)',
        'Canvas fingerprint hash (if provided)',
      ],
      purpose:
        'Device fingerprinting is used to detect suspicious login attempts and protect your account. We use one-way hashing to store fingerprints, meaning the original data cannot be recovered.',
      retention:
        'Fingerprint hashes are retained for the duration of the session plus 30 days for security analysis. They are automatically deleted after this period.',
    };
  }
}
