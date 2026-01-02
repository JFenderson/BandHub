import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { KNOWN_BAND_NAMES, CONFERENCES, DIVISIONS } from '../../config/hbcu-bands';

export function IsValidBandName(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidBandName',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          // Check if name exists in our master list (case-insensitive)
          return KNOWN_BAND_NAMES.some(name => name.toLowerCase() === value.toLowerCase());
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a recognized HBCU band name`;
        },
      },
    });
  };
}

export function IsValidConference(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidConference',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && CONFERENCES.includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be one of: ${CONFERENCES.join(', ')}`;
        },
      },
    });
  };
}