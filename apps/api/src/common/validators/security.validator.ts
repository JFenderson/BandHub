import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumber = /[0-9]/.test(value);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
          const isValidLength = value.length >= 8 && value.length <= 128;
          return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && isValidLength;
        },
        defaultMessage(args: ValidationArguments) {
          return `Password must be 8-128 characters and include uppercase, lowercase, number, and special character`;
        },
      },
    });
  };
}

export function IsValidSocialMediaUrl(platform: 'facebook' | 'twitter' | 'instagram' | 'tiktok', validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidSocialMediaUrl',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [platform],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const [platform] = args.constraints;
          const domains: Record<string, string> = {
            facebook: 'facebook.com',
            twitter: 'twitter.com', // also allow x.com
            instagram: 'instagram.com',
            tiktok: 'tiktok.com'
          };
          
          try {
            const url = new URL(value);
            if (platform === 'twitter') {
                return url.hostname.includes('twitter.com') || url.hostname.includes('x.com');
            }
            return url.hostname.includes(domains[platform]);
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid ${args.constraints[0]} URL`;
        },
      },
    });
  };
}