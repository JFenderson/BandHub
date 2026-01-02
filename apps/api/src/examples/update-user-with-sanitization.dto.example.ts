/**
 * Example: Updated UpdateUserDto with Sanitization
 * 
 * This shows how to sanitize user-generated content like bios and profiles.
 * User input is a prime target for XSS attacks.
 * 
 * File: apps/api/src/modules/users/dto/update-user.dto.ts
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsUrl } from 'class-validator';
import { SanitizeText, SanitizeDescription, SanitizeUrl } from '../common';

export class UpdateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @SanitizeText() // Strict sanitization for names
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @SanitizeUrl() // Validate and sanitize avatar URLs
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({
    description: 'User bio/description',
    example: 'Band enthusiast and HBCU alumnus',
    required: false,
  })
  @SanitizeDescription() // Allow text but remove HTML and scripts
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'User preferences JSON object',
    required: false,
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}