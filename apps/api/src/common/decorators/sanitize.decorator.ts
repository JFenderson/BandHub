/**
 * Sanitization Decorator
 * 
 * Property decorator that marks fields for automatic sanitization.
 * This decorator stores metadata that the SanitizationPipe uses to
 * determine how to sanitize each field.
 * 
 * Usage in DTOs:
 * 
 * @Sanitize({ level: SanitizationLevel.STRICT, fieldType: FieldType.TEXT })
 * @IsString()
 * name: string;
 * 
 * @SanitizeText()
 * @IsString()
 * title: string;
 * 
 * @SanitizeUrl({ allowedDomains: ['youtube.com'] })
 * @IsUrl()
 * videoUrl: string;
 */

import 'reflect-metadata';
import {
  SanitizationOptions,
  SanitizationLevel,
  FieldType,
  SANITIZATION_PRESETS,
} from '../types/sanitization.types';

/**
 * Metadata key for storing sanitization options
 */
export const SANITIZE_METADATA_KEY = 'sanitize:options';

/**
 * Main sanitization decorator
 * 
 * @param options - Sanitization options for this field
 */
export function Sanitize(options?: SanitizationOptions): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(
      SANITIZE_METADATA_KEY,
      { options: options || {}, propertyKey },
      target,
      propertyKey,
    );
  };
}

/**
 * Decorator for text fields (band names, titles, etc.)
 * Uses STRICT sanitization by default
 */
export function SanitizeText(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.NAME,
    ...options,
    fieldType: FieldType.TEXT,
  });
}

/**
 * Decorator for description fields
 * Allows basic formatting but no HTML
 */
export function SanitizeDescription(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.DESCRIPTION,
    ...options,
    fieldType: FieldType.DESCRIPTION,
  });
}

/**
 * Decorator for rich text content
 * Allows specified HTML tags
 */
export function SanitizeRichText(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.RICH_TEXT,
    ...options,
    fieldType: FieldType.RICH_TEXT,
  });
}

/**
 * Decorator for URL fields
 * Validates and sanitizes URLs
 */
export function SanitizeUrl(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.URL,
    ...options,
    fieldType: FieldType.URL,
  });
}

/**
 * Decorator for YouTube URL fields
 * Only allows YouTube domains
 */
export function SanitizeYouTubeUrl(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.YOUTUBE_URL,
    ...options,
    fieldType: FieldType.URL,
  });
}

/**
 * Decorator for email fields
 */
export function SanitizeEmail(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.EMAIL,
    ...options,
    fieldType: FieldType.EMAIL,
  });
}

/**
 * Decorator for search query fields
 */
export function SanitizeSearch(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.SEARCH,
    ...options,
    fieldType: FieldType.SEARCH,
  });
}

/**
 * Decorator for file name fields
 */
export function SanitizeFilename(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.FILENAME,
    ...options,
    fieldType: FieldType.FILENAME,
  });
}

/**
 * Decorator for slug fields
 */
export function SanitizeSlug(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    ...SANITIZATION_PRESETS.SLUG,
    ...options,
    fieldType: FieldType.SLUG,
  });
}

/**
 * Decorator for HTML content (use with extreme caution)
 * Still removes dangerous content like scripts
 */
export function SanitizeHtml(options?: Partial<SanitizationOptions>): PropertyDecorator {
  return Sanitize({
    level: SanitizationLevel.PERMISSIVE,
    fieldType: FieldType.HTML,
    ...options,
  });
}

/**
 * Method decorator to sanitize all string parameters
 * Useful for controller methods
 * 
 * @example
 * @SanitizeParams()
 * @Get(':id')
 * findOne(@Param('id') id: string) {
 *   // id is automatically sanitized
 * }
 */
export function SanitizeParams(options?: SanitizationOptions): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(
      SANITIZE_METADATA_KEY,
      { options: options || {}, propertyKey },
      target,
      propertyKey,
    );
    return descriptor;
  };
}

/**
 * Class decorator to apply sanitization to all string properties
 * Useful for DTOs where all fields need sanitization
 * 
 * @example
 * @SanitizeAll({ level: SanitizationLevel.STRICT })
 * export class CreateBandDto {
 *   name: string;
 *   description: string;
 * }
 */
export function SanitizeAll(options?: SanitizationOptions): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(SANITIZE_METADATA_KEY, { options: options || {} }, target);
  };
}