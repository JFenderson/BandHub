/**
 * Sanitization Types and Interfaces
 * 
 * Defines the configuration and types used throughout the sanitization system.
 * These types ensure type safety when configuring sanitization rules.
 */

/**
 * Sanitization levels determine how aggressive the sanitization is.
 * 
 * STRICT: Maximum security - strips most HTML, very restrictive
 * MODERATE: Balanced approach - allows some formatting, removes dangerous content
 * PERMISSIVE: Minimal sanitization - preserves most content, removes only critical threats
 */
export enum SanitizationLevel {
  STRICT = 'strict',
  MODERATE = 'moderate',
  PERMISSIVE = 'permissive',
}

/**
 * Field types help determine appropriate sanitization strategy
 */
export enum FieldType {
  TEXT = 'text',              // Plain text fields (band names, titles)
  DESCRIPTION = 'description', // Text that may contain basic formatting
  RICH_TEXT = 'rich_text',    // Rich text content with HTML
  URL = 'url',                // URLs that need validation
  EMAIL = 'email',            // Email addresses
  SEARCH = 'search',          // Search query strings
  FILENAME = 'filename',      // File names for uploads
  SLUG = 'slug',              // URL-safe slugs
  HTML = 'html',              // HTML content (use with caution)
}

/**
 * Configuration options for sanitization
 */
export interface SanitizationOptions {
  /**
   * Sanitization level - determines aggressiveness
   */
  level?: SanitizationLevel;

  /**
   * Field type - helps determine appropriate strategy
   */
  fieldType?: FieldType;

  /**
   * Maximum length after sanitization (0 = no limit)
   */
  maxLength?: number;

  /**
   * Whether to trim whitespace
   */
  trim?: boolean;

  /**
   * Whether to allow HTML entities (e.g., &amp;, &lt;)
   */
  allowHtmlEntities?: boolean;

  /**
   * Allowed HTML tags (for RICH_TEXT and HTML field types)
   * Example: ['p', 'br', 'strong', 'em']
   */
  allowedTags?: string[];

  /**
   * Allowed HTML attributes (for RICH_TEXT and HTML field types)
   * Example: ['href', 'title', 'class']
   */
  allowedAttributes?: string[];

  /**
   * Allowed URL protocols (for URL validation)
   * Example: ['http', 'https']
   */
  allowedProtocols?: string[];

  /**
   * Allowed domains for URLs (empty = all domains allowed)
   * Example: ['youtube.com', 'youtu.be']
   */
  allowedDomains?: string[];

  /**
   * Custom sanitization function
   */
  customSanitizer?: (value: string) => string;
}

/**
 * Result of a sanitization operation
 */
export interface SanitizationResult {
  /**
   * The sanitized value
   */
  value: string;

  /**
   * Whether the value was modified during sanitization
   */
  modified: boolean;

  /**
   * Array of issues found during sanitization
   */
  issues?: string[];

  /**
   * Original value (for debugging/logging)
   */
  original?: string;
}

/**
 * Metadata for the @Sanitize decorator
 */
export interface SanitizeMetadata {
  propertyKey: string | symbol;
  options: SanitizationOptions;
}

/**
 * Predefined sanitization configurations for common use cases
 */
export const SANITIZATION_PRESETS: Record<string, SanitizationOptions> = {
  /**
   * Band names, user names, titles
   */
  NAME: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.TEXT,
    maxLength: 255,
    trim: true,
    allowHtmlEntities: false,
  },

  /**
   * Descriptions, bios, about text
   */
  DESCRIPTION: {
    level: SanitizationLevel.MODERATE,
    fieldType: FieldType.DESCRIPTION,
    maxLength: 5000,
    trim: true,
    allowHtmlEntities: true,
    allowedTags: [], // No HTML tags allowed, but entities are OK
  },

  /**
   * Rich text content (blog posts, articles)
   */
  RICH_TEXT: {
    level: SanitizationLevel.MODERATE,
    fieldType: FieldType.RICH_TEXT,
    maxLength: 50000,
    trim: true,
    allowHtmlEntities: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3'],
    allowedAttributes: ['href', 'title', 'target', 'rel'],
  },

  /**
   * YouTube URLs
   */
  YOUTUBE_URL: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.URL,
    trim: true,
    allowedProtocols: ['http', 'https'],
    allowedDomains: ['youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com'],
  },

  /**
   * General URLs
   */
  URL: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.URL,
    trim: true,
    allowedProtocols: ['http', 'https'],
  },

  /**
   * Search queries
   */
  SEARCH: {
    level: SanitizationLevel.MODERATE,
    fieldType: FieldType.SEARCH,
    maxLength: 500,
    trim: true,
    allowHtmlEntities: false,
  },

  /**
   * File names
   */
  FILENAME: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.FILENAME,
    maxLength: 255,
    trim: true,
    allowHtmlEntities: false,
  },

  /**
   * URL slugs
   */
  SLUG: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.SLUG,
    maxLength: 255,
    trim: true,
    allowHtmlEntities: false,
  },

  /**
   * Email addresses
   */
  EMAIL: {
    level: SanitizationLevel.STRICT,
    fieldType: FieldType.EMAIL,
    maxLength: 255,
    trim: true,
    allowHtmlEntities: false,
  },
};

/**
 * Default sanitization options
 */
export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  level: SanitizationLevel.MODERATE,
  fieldType: FieldType.TEXT,
  maxLength: 0, // No limit
  trim: true,
  allowHtmlEntities: false,
  allowedTags: [],
  allowedAttributes: [],
  allowedProtocols: ['http', 'https'],
  allowedDomains: [],
};