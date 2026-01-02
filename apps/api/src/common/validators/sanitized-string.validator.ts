/**
 * Custom Class-Validator Decorator for Sanitization
 * 
 * This decorator integrates with class-validator to provide validation
 * that ensures input is sanitized. It can be chained with other validators.
 * 
 * Usage:
 * @IsSanitized({ level: SanitizationLevel.STRICT, fieldType: FieldType.TEXT })
 * name: string;
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { sanitize } from '../utils/sanitization.util';
import { SanitizationOptions, SanitizationLevel } from '../types/sanitization.types';

/**
 * Validator constraint for sanitization checking
 */
@ValidatorConstraint({ name: 'isSanitized', async: false })
export class IsSanitizedConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === null || value === undefined) {
      return true; // Let @IsNotEmpty or @IsOptional handle null/undefined
    }

    const options: SanitizationOptions = args.constraints[0] || {};
    const result = sanitize(value, options);

    // If the sanitized value differs from original, the input wasn't clean
    return !result.modified;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: SanitizationOptions = args.constraints[0] || {};
    const result = sanitize(args.value, options);

    if (result.issues && result.issues.length > 0) {
      return `${args.property} contains invalid content: ${result.issues.join(', ')}`;
    }

    return `${args.property} contains potentially unsafe content`;
  }
}

/**
 * Decorator to validate that input is sanitized
 * 
 * This performs validation but doesn't transform the value.
 * Use @Sanitize decorator if you want automatic transformation.
 * 
 * @param options - Sanitization options
 * @param validationOptions - Standard class-validator options
 */
export function IsSanitized(
  options?: SanitizationOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSanitized',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsSanitizedConstraint,
    });
  };
}

/**
 * Decorator for sanitized strings (most common use case)
 */
export function IsSanitizedString(
  options?: SanitizationOptions,
  validationOptions?: ValidationOptions,
) {
  return IsSanitized(
    {
      level: SanitizationLevel.MODERATE,
      trim: true,
      ...options,
    },
    validationOptions,
  );
}

/**
 * Decorator for band names (strict sanitization)
 */
export function IsBandName(validationOptions?: ValidationOptions) {
  return IsSanitized(
    {
      level: SanitizationLevel.STRICT,
      maxLength: 255,
      trim: true,
      allowHtmlEntities: false,
    },
    {
      message: 'Band name contains invalid characters',
      ...validationOptions,
    },
  );
}

/**
 * Decorator for video titles (moderate sanitization)
 */
export function IsVideoTitle(validationOptions?: ValidationOptions) {
  return IsSanitized(
    {
      level: SanitizationLevel.MODERATE,
      maxLength: 500,
      trim: true,
      allowHtmlEntities: true,
    },
    {
      message: 'Video title contains invalid content',
      ...validationOptions,
    },
  );
}

/**
 * Decorator for descriptions (allows basic formatting)
 */
export function IsDescription(validationOptions?: ValidationOptions) {
  return IsSanitized(
    {
      level: SanitizationLevel.MODERATE,
      maxLength: 5000,
      trim: true,
      allowHtmlEntities: true,
    },
    {
      message: 'Description contains invalid content',
      ...validationOptions,
    },
  );
}

/**
 * Decorator for search queries
 */
export function IsSearchQuery(validationOptions?: ValidationOptions) {
  return IsSanitized(
    {
      level: SanitizationLevel.MODERATE,
      maxLength: 500,
      trim: true,
      allowHtmlEntities: false,
    },
    {
      message: 'Search query contains invalid characters',
      ...validationOptions,
    },
  );
}