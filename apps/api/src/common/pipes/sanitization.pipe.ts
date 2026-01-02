/**
 * Sanitization Pipe
 * 
 * A NestJS pipe that automatically sanitizes incoming request data.
 * This pipe runs BEFORE validation, transforming potentially dangerous input
 * into safe data before it reaches your controllers.
 * 
 * Usage:
 * 1. Global: app.useGlobalPipes(new SanitizationPipe())
 * 2. Controller: @UsePipes(SanitizationPipe)
 * 3. Route: @Post() create(@Body(SanitizationPipe) dto: CreateBandDto)
 */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  Type,
  Logger,
} from '@nestjs/common';
import { sanitize } from '../utils/sanitization.util';
import { SanitizationOptions, SANITIZATION_PRESETS } from '../types/sanitization.types';
import { SANITIZE_METADATA_KEY } from '../decorators/sanitize.decorator';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(SanitizationPipe.name);

  /**
   * Whether to log sanitization actions
   */
  private readonly enableLogging: boolean;

  /**
   * Whether to sanitize recursively (nested objects)
   */
  private readonly recursive: boolean;

  constructor(options?: { enableLogging?: boolean; recursive?: boolean }) {
    this.enableLogging = options?.enableLogging ?? false;
    this.recursive = options?.recursive ?? true;
  }

  /**
   * Transform the value by sanitizing it
   */
  transform(value: any, metadata: ArgumentMetadata): any {
    // Skip if value is null, undefined, or not an object/string
    if (value === null || value === undefined) {
      return value;
    }

    // Get the metatype (DTO class)
    const metatype = metadata.metatype;

    // If we don't have a metatype or it's a primitive, return as-is
    if (!metatype || !this.shouldSanitize(metatype)) {
      return value;
    }

    // Sanitize based on value type
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return this.sanitizeArray(value, metatype);
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value, metatype);
    }

    return value;
  }

  /**
   * Check if we should sanitize this type
   */
  private shouldSanitize(metatype: Type<any>): boolean {
    // Don't sanitize native types
    const types: Type<any>[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Sanitize a string value
   */
  private sanitizeString(value: string, options?: SanitizationOptions): string {
    const result = sanitize(value, options);

    if (this.enableLogging && result.modified) {
      this.logger.debug(`Sanitized string: ${result.issues?.join(', ')}`);
    }

    return result.value;
  }

  /**
   * Sanitize an array of values
   */
  private sanitizeArray(values: any[], metatype: Type<any>): any[] {
    if (!this.recursive) {
      return values;
    }

    return values.map(value => {
      if (typeof value === 'string') {
        return this.sanitizeString(value);
      }
      if (typeof value === 'object' && value !== null) {
        return this.sanitizeObject(value, metatype);
      }
      return value;
    });
  }

  /**
   * Sanitize an object (DTO)
   */
  private sanitizeObject(obj: any, metatype: Type<any>): any {
    if (!this.recursive) {
      return obj;
    }

    const sanitized: any = {};

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      // Get sanitization metadata for this property
      const metadata = this.getPropertyMetadata(metatype, key);

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, metadata?.options);
      } else if (Array.isArray(value)) {
        sanitized[key] = this.sanitizeArray(value, metatype);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, metatype);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get sanitization metadata for a property from @Sanitize decorator
   */
  private getPropertyMetadata(metatype: Type<any>, propertyKey: string): { options: SanitizationOptions } | undefined {
    try {
      // Try to get metadata from the @Sanitize decorator
      const metadata = Reflect.getMetadata(SANITIZE_METADATA_KEY, metatype.prototype, propertyKey);
      return metadata;
    } catch (error) {
      return undefined;
    }
  }
}

/**
 * Pipe for strict sanitization (useful for sensitive fields)
 */
@Injectable()
export class StrictSanitizationPipe implements PipeTransform {
  private readonly sanitizationPipe: SanitizationPipe;

  constructor() {
    this.sanitizationPipe = new SanitizationPipe({ enableLogging: true, recursive: true });
  }

  transform(value: any, metadata: ArgumentMetadata): any {
    return this.sanitizationPipe.transform(value, metadata);
  }
}

/**
 * Pipe for query parameter sanitization
 * More lenient than body sanitization
 */
@Injectable()
export class QuerySanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(QuerySanitizationPipe.name);

  transform(value: any, metadata: ArgumentMetadata): any {
    if (typeof value === 'string') {
      const result = sanitize(value, SANITIZATION_PRESETS.SEARCH);

      if (result.modified) {
        this.logger.debug(`Sanitized query parameter: ${metadata.data}`);
      }

      return result.value;
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string') {
          const result = sanitize(value[key], SANITIZATION_PRESETS.SEARCH);
          sanitized[key] = result.value;
        } else {
          sanitized[key] = value[key];
        }
      }
      return sanitized;
    }

    return value;
  }
}