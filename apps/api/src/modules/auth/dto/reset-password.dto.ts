import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ 
    description: 'Password reset token received via email',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    required: true,
  })
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @ApiProperty({ 
    description: 'New password. Must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
    example: 'NewSecurePass123!',
    minLength: 8,
    maxLength: 128,
    format: 'password',
    required: true,
  })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;
}
