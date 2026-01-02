import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsValidDateRange(startField: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidDateRange',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [startField],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const startDate = (args.object as any)[relatedPropertyName];
          
          if (!startDate || !value) return true; // Skip if either is missing (handle with @IsNotEmpty if needed)
          
          return new Date(value) > new Date(startDate);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be after ${args.constraints[0]}`;
        },
      },
    });
  };
}