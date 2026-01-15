import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, Matches, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Username (3-30 characters, alphanumeric and underscore only)',
    example: 'john_doe_123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must be at most 30 characters long' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain alphanumeric characters and underscores',
  })
  username?: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: 'User bio/description',
    example: 'Band enthusiast and HBCU alumnus',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'User social media links',
    required: false,
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @ApiProperty({
    description: 'User preferences JSON object',
    required: false,
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
