import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@hbcubandhub.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'SecurePassword123!',
    minLength: 8,
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
  @ApiProperty({ description: 'Access token for API requests' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'Admin user information' })
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };

  @ApiPropertyOptional({ description: 'Whether MFA verification is required' })
  requiresMfa?: boolean;
}