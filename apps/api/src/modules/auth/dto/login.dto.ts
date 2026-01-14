import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Admin email address used for authentication',
    example: 'admin@hbcubandhub.com',
    format: 'email',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Admin password (minimum 8 characters, must include uppercase, lowercase, number, and symbol)',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
    required: true,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'TOTP code for MFA verification (required if MFA is enabled)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  mfaToken?: string;

  @ApiPropertyOptional({
    description: 'Device fingerprint for security tracking',
    example: 'abc123...',
  })
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}

export class LoginResponseDto {
  @ApiProperty({ 
    description: 'JWT access token for authenticating API requests. Include in Authorization header as "Bearer {token}"',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'Refresh token for obtaining new access tokens when the current one expires. Store securely.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.4Adcj0qBh6vr1S9f8BF3vXr1tX7gI3nRCfcO0hfLqzE',
  })
  refreshToken: string;

  @ApiProperty({ 
    description: 'Access token expiration time in seconds (typically 900 for 15 minutes)',
    example: 900,
    minimum: 1,
  })
  expiresIn: number;

  @ApiProperty({ 
    description: 'Authenticated admin user information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'clx7yj8k90000uxl9aabbccdd', description: 'Unique user ID' },
      email: { type: 'string', example: 'admin@hbcubandhub.com', description: 'User email address' },
      name: { type: 'string', example: 'John Doe', description: 'User full name' },
      role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'], example: 'ADMIN', description: 'User role' },
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };

  @ApiPropertyOptional({ 
    description: 'Indicates if multi-factor authentication (MFA) verification is required. If true, user must provide MFA code in a subsequent request.',
    example: false,
  })
  requiresMfa?: boolean;
}