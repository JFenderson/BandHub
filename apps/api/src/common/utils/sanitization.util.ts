/**
 * Core Sanitization Utilities
 * 
 * Provides low-level sanitization functions for different types of input.
 * These functions are used by decorators, pipes, and validators.
 * 
 * Security principles:
 * 1. Deny by default - strip anything not explicitly allowed
 * 2. Defense in depth - multiple layers of protection
 * 3. Context-aware - different sanitization for different field types
 */

import { validate as validateEmail } from 'class-validator';
import {
  SanitizationOptions,
  SanitizationResult,
  SanitizationLevel,
  FieldType,
  DEFAULT_SANITIZATION_OPTIONS,
} from '../types/sanitization.types';

/**
 * Main sanitization function - routes to appropriate sanitizer based on field type
 */
export function sanitize(value: any, options: SanitizationOptions = {}): SanitizationResult {
  // Merge with defaults
  const opts: SanitizationOptions = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };

  // Handle non-string values
  if (value === null || value === undefined) {
    return { value: '', modified: false };
  }

  // Convert to string
  const stringValue = String(value);
  const original = stringValue;

  // Apply sanitization based on field type
  let sanitized: string;
  const issues: string[] = [];

  switch (opts.fieldType) {
    case FieldType.URL:
      sanitized = sanitizeUrl(stringValue, opts, issues);
      break;
    case FieldType.EMAIL:
      sanitized = sanitizeEmail(stringValue, opts, issues);
      break;
    case FieldType.FILENAME:
      sanitized = sanitizeFilename(stringValue, opts, issues);
      break;
    case FieldType.SLUG:
      sanitized = sanitizeSlug(stringValue, opts, issues);
      break;
    case FieldType.SEARCH:
      sanitized = sanitizeSearch(stringValue, opts, issues);
      break;
    case FieldType.RICH_TEXT:
      sanitized = sanitizeRichText(stringValue, opts, issues);
      break;
    case FieldType.HTML:
      sanitized = sanitizeHtml(stringValue, opts, issues);
      break;
    case FieldType.DESCRIPTION:
      sanitized = sanitizeDescription(stringValue, opts, issues);
      break;
    case FieldType.TEXT:
    default:
      sanitized = sanitizeText(stringValue, opts, issues);
      break;
  }

  // Apply custom sanitizer if provided
  if (opts.customSanitizer) {
    sanitized = opts.customSanitizer(sanitized);
  }

  // Trim if requested
  if (opts.trim) {
    sanitized = sanitized.trim();
  }

  // Apply max length
  if (opts.maxLength && opts.maxLength > 0 && sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
    issues.push(`Truncated to ${opts.maxLength} characters`);
  }

  return {
    value: sanitized,
    modified: sanitized !== original,
    issues: issues.length > 0 ? issues : undefined,
    original: sanitized !== original ? original : undefined,
  };
}

/**
 * Sanitize plain text fields (band names, titles, etc.)
 */
export function sanitizeText(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value;

  // Remove all HTML tags
  sanitized = stripHtmlTags(sanitized);

  // Encode HTML entities based on level
  if (options.level === SanitizationLevel.STRICT) {
    sanitized = encodeHtmlEntities(sanitized);
  } else if (!options.allowHtmlEntities) {
    sanitized = encodeHtmlEntities(sanitized);
  }

  // Remove control characters
  sanitized = removeControlCharacters(sanitized);

  // Remove SQL injection patterns
  sanitized = removeSqlInjectionPatterns(sanitized, issues);

  // Normalize whitespace
  sanitized = normalizeWhitespace(sanitized);

  return sanitized;
}

/**
 * Sanitize description fields (allows basic formatting, no HTML)
 */
export function sanitizeDescription(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value;

  // Remove script tags and event handlers
  sanitized = removeScriptTags(sanitized, issues);
  sanitized = removeEventHandlers(sanitized, issues);

  // Remove all HTML tags (descriptions shouldn't have HTML)
  sanitized = stripHtmlTags(sanitized);

  // Encode HTML entities if not allowed
  if (!options.allowHtmlEntities) {
    sanitized = encodeHtmlEntities(sanitized);
  }

  // Remove SQL injection patterns
  sanitized = removeSqlInjectionPatterns(sanitized, issues);

  // Normalize whitespace but preserve line breaks
  sanitized = sanitized.replace(/[ \t]+/g, ' '); // Collapse spaces and tabs
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive line breaks

  return sanitized;
}

/**
 * Sanitize rich text content (allows specified HTML tags)
 */
export function sanitizeRichText(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value;

  // Remove dangerous tags
  sanitized = removeScriptTags(sanitized, issues);
  sanitized = removeEventHandlers(sanitized, issues);
  sanitized = removeDangerousTags(sanitized, issues);

  // Allow only specified tags
  if (options.allowedTags && options.allowedTags.length > 0) {
    sanitized = allowOnlySpecifiedTags(sanitized, options.allowedTags, options.allowedAttributes || [], issues);
  } else {
    // If no tags specified, strip all HTML
    sanitized = stripHtmlTags(sanitized);
  }

  return sanitized;
}

/**
 * Sanitize HTML content (most permissive, but still removes dangerous content)
 */
export function sanitizeHtml(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value;

  // Remove script tags
  sanitized = removeScriptTags(sanitized, issues);
  
  // Remove event handlers
  sanitized = removeEventHandlers(sanitized, issues);
  
  // Remove dangerous tags
  sanitized = removeDangerousTags(sanitized, issues);

  // Remove javascript: protocol from URLs
  sanitized = removeJavascriptProtocol(sanitized, issues);

  return sanitized;
}

/**
 * Sanitize URL fields
 */
export function sanitizeUrl(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value.trim();

  // Check for javascript: protocol
  if (/^javascript:/i.test(sanitized)) {
    issues.push('Blocked javascript: protocol in URL');
    return '';
  }

  // Check for data: protocol (can be used for XSS)
  if (options.level === SanitizationLevel.STRICT && /^data:/i.test(sanitized)) {
    issues.push('Blocked data: protocol in URL');
    return '';
  }

  // Validate protocol
  if (options.allowedProtocols && options.allowedProtocols.length > 0) {
    const protocolMatch = sanitized.match(/^([a-z][a-z0-9+.-]*):\/\//i);
    if (protocolMatch) {
      const protocol = protocolMatch[1].toLowerCase();
      if (!options.allowedProtocols.includes(protocol)) {
        issues.push(`Protocol '${protocol}' not allowed`);
        return '';
      }
    }
  }

  // Validate domain (for external URLs)
  if (options.allowedDomains && options.allowedDomains.length > 0) {
    try {
      const url = new URL(sanitized);
      const hostname = url.hostname.toLowerCase();
      
      const isAllowed = options.allowedDomains.some(domain => {
        return hostname === domain || hostname.endsWith('.' + domain);
      });

      if (!isAllowed) {
        issues.push(`Domain '${hostname}' not allowed`);
        return '';
      }
    } catch (e) {
      issues.push('Invalid URL format');
      return '';
    }
  }

  // Encode special characters
  sanitized = encodeUrlSpecialChars(sanitized);

  return sanitized;
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value.toLowerCase().trim();

  // Remove anything that's not part of a valid email
  sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');

  // Basic email validation
  if (!isValidEmailFormat(sanitized)) {
    issues.push('Invalid email format');
    return '';
  }

  return sanitized;
}

/**
 * Sanitize file names
 */
export function sanitizeFilename(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value.trim();

  // Remove path separators
  sanitized = sanitized.replace(/[/\\]/g, '');

  // Remove special characters that could cause issues
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');

  // Limit to alphanumeric, dash, underscore, and dot
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent multiple dots (except before extension)
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    const extension = parts.pop();
    const filename = parts.join('_');
    sanitized = `${filename}.${extension}`;
  }

  // Ensure not empty
  if (!sanitized || sanitized === '.') {
    sanitized = 'file';
  }

  return sanitized;
}

/**
 * Sanitize URL slugs
 */
export function sanitizeSlug(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value.toLowerCase().trim();

  // Replace spaces with hyphens
  sanitized = sanitized.replace(/\s+/g, '-');

  // Remove special characters
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '');

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  return sanitized;
}

/**
 * Sanitize search queries
 */
export function sanitizeSearch(value: string, options: SanitizationOptions, issues: string[]): string {
  let sanitized = value.trim();

  // Remove HTML tags
  sanitized = stripHtmlTags(sanitized);

  // Remove SQL injection patterns
  sanitized = removeSqlInjectionPatterns(sanitized, issues);

  // Encode special regex characters if needed
  if (options.level === SanitizationLevel.STRICT) {
    sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return sanitized;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Strip all HTML tags
 */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Remove script tags and their content
 */
function removeScriptTags(value: string, issues: string[]): string {
  const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  if (scriptPattern.test(value)) {
    issues.push('Removed script tags');
  }
  return value.replace(scriptPattern, '');
}

/**
 * Remove event handlers (onclick, onerror, etc.)
 */
function removeEventHandlers(value: string, issues: string[]): string {
  const eventPattern = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
  if (eventPattern.test(value)) {
    issues.push('Removed event handlers');
  }
  return value.replace(eventPattern, '');
}

/**
 * Remove dangerous HTML tags
 */
function removeDangerousTags(value: string, issues: string[]): string {
  const dangerousTags = ['iframe', 'object', 'embed', 'applet', 'meta', 'link', 'style', 'base', 'form'];
  let sanitized = value;

  for (const tag of dangerousTags) {
    const pattern = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    if (pattern.test(sanitized)) {
      issues.push(`Removed ${tag} tags`);
      sanitized = sanitized.replace(pattern, '');
    }
  }

  return sanitized;
}

/**
 * Remove javascript: protocol from URLs
 */
function removeJavascriptProtocol(value: string, issues: string[]): string {
  const jsProtocolPattern = /javascript:/gi;
  if (jsProtocolPattern.test(value)) {
    issues.push('Removed javascript: protocol');
  }
  return value.replace(jsProtocolPattern, '');
}

/**
 * Allow only specified HTML tags and attributes
 */
function allowOnlySpecifiedTags(
  value: string,
  allowedTags: string[],
  allowedAttributes: string[],
  issues: string[],
): string {
  // This is a simplified implementation
  // For production, consider using a library like DOMPurify
  
  let sanitized = value;
  
  // Remove all tags except allowed ones
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // If tag is allowed, check attributes
      if (allowedAttributes.length > 0) {
        return filterAttributes(match, allowedAttributes);
      }
      return match;
    } else {
      issues.push(`Removed disallowed tag: ${tagName}`);
      return '';
    }
  });

  return sanitized;
}

/**
 * Filter HTML attributes to only allowed ones
 */
function filterAttributes(tag: string, allowedAttributes: string[]): string {
  // Simple attribute filtering
  return tag.replace(/\s+([a-z][a-z0-9-]*)\s*=\s*["'][^"']*["']/gi, (match, attrName) => {
    if (allowedAttributes.includes(attrName.toLowerCase())) {
      return match;
    }
    return '';
  });
}

/**
 * Encode HTML entities
 */
export function encodeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Remove control characters
 */
function removeControlCharacters(value: string): string {
  // Remove control characters except tab, line feed, and carriage return
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Remove common SQL injection patterns
 * Note: Prisma provides SQL injection protection, but this is an extra layer
 */
function removeSqlInjectionPatterns(value: string, issues: string[]): string {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\#|\/\*|\*\/)/g, // SQL comments
    /('|('')|;|--|\||%|\*)/g, // Common SQL injection characters
  ];

  let sanitized = value;
  let modified = false;

  for (const pattern of sqlPatterns) {
    if (pattern.test(sanitized)) {
      modified = true;
      sanitized = sanitized.replace(pattern, '');
    }
  }

  if (modified) {
    issues.push('Removed potential SQL injection patterns');
  }

  return sanitized;
}

/**
 * Normalize whitespace
 */
function normalizeWhitespace(value: string): string {
  return value
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/^\s+|\s+$/g, ''); // Trim
}

/**
 * Encode special characters in URLs
 */
function encodeUrlSpecialChars(value: string): string {
  // This is a basic implementation
  // The browser's URL encoding is more comprehensive
  return value
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, '%22')
    .replace(/'/g, '%27');
}

/**
 * Basic email format validation
 */
function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Batch sanitize multiple values
 */
export function sanitizeBatch(
  values: Record<string, any>,
  optionsMap: Record<string, SanitizationOptions>,
): Record<string, SanitizationResult> {
  const results: Record<string, SanitizationResult> = {};

  for (const [key, value] of Object.entries(values)) {
    const options = optionsMap[key] || {};
    results[key] = sanitize(value, options);
  }

  return results;
}