import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsYouTubeVideoId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isYouTubeVideoId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Standard YouTube Video ID: 11 characters, alphanumeric + _ and -
          const regex = /^[a-zA-Z0-9_-]{11}$/;
          return typeof value === 'string' && regex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid 11-character YouTube Video ID`;
        },
      },
    });
  };
}

export function IsYouTubeChannelId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isYouTubeChannelId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Standard Channel ID: starts with UC, 24 characters total
          const regex = /^UC[a-zA-Z0-9_-]{22}$/;
          return typeof value === 'string' && regex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid YouTube Channel ID (starting with UC)`;
        },
      },
    });
  };
}