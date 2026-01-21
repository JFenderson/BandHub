import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PasswordPolicyService } from '../services/password-policy.service';
import { SecurityService } from '../services/security.service';

class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewSecurePassword456!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

class ValidatePasswordDto {
  @ApiProperty({
    description: 'Password to validate',
    example: 'TestPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

class UpdatePasswordPolicyDto {
  @ApiProperty({ required: false, description: 'Minimum password length' })
  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(32)
  minLength?: number;

  @ApiProperty({ required: false, description: 'Maximum password length' })
  @IsOptional()
  @IsNumber()
  @Min(32)
  @Max(256)
  maxLength?: number;

  @ApiProperty({ required: false, description: 'Require uppercase letters' })
  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @ApiProperty({ required: false, description: 'Require lowercase letters' })
  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;

  @ApiProperty({ required: false, description: 'Require numbers' })
  @IsOptional()
  @IsBoolean()
  requireNumbers?: boolean;

  @ApiProperty({ required: false, description: 'Require special characters' })
  @IsOptional()
  @IsBoolean()
  requireSymbols?: boolean;

  @ApiProperty({ required: false, description: 'Password expiration days (0 = never)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  expirationDays?: number;

  @ApiProperty({ required: false, description: 'Number of previous passwords to remember' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  historyCount?: number;

  @ApiProperty({ required: false, description: 'Max failed login attempts before lockout' })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  maxFailedAttempts?: number;

  @ApiProperty({ required: false, description: 'Account lockout duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  lockoutDurationMinutes?: number;
}

@ApiTags('Password Management')
@Controller({ path: 'auth/password', version: '1' })
export class PasswordController {
  constructor(
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly securityService: SecurityService,
  ) {}

  @Get('requirements')
  @ApiOperation({ summary: 'Get password requirements' })
  @ApiResponse({
    status: 200,
    description: 'Password requirements',
  })
  async getRequirements(): Promise<{ requirements: string[] }> {
    const requirements = await this.passwordPolicyService.getPasswordRequirements();
    return { requirements };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a password against policy (without changing it)' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
  })
  async validatePassword(
    @Body() dto: ValidatePasswordDto,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    return this.passwordPolicyService.validatePassword(dto.password);
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for current user' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password or new password does not meet requirements',
  })
  async changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
    @Ip() ipAddress: string,
  ): Promise<{ message: string }> {
    await this.passwordPolicyService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );

    await this.securityService.logPasswordChanged(req.user.id, ipAddress);

    return { message: 'Password changed successfully' };
  }

  @Get('policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current password policy (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Current password policy',
  })
  async getPolicy() {
    return this.passwordPolicyService.getActivePolicy();
  }

  @Put('policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update password policy (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Updated password policy',
  })
  async updatePolicy(@Body() dto: UpdatePasswordPolicyDto) {
    return this.passwordPolicyService.updatePolicy(dto);
  }
}
