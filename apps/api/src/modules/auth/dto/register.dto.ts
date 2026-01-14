import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address. Must be unique and valid.',
    example: 'admin@bandhub.com',
    format: 'email',
    required: true,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description:
      'User password. Must be at least 8 characters and include uppercase letter, lowercase letter, number, and symbol.',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
    required: true,
    format: 'password',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({
    description: 'User full name (first and last name)',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
    required: true,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;
  role: string;
}
