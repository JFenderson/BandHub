import {
  Controller,
  Post,
  Get,
  Delete,
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
import { IsString, IsNotEmpty, Length } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MfaService } from '../services/mfa.service';
import { SecurityService } from '../services/security.service';

class VerifyMfaDto {
  @ApiProperty({
    description: 'TOTP verification code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 8)
  token: string;
}

@ApiTags('Multi-Factor Authentication')
@Controller({ path: 'auth/mfa', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly securityService: SecurityService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get MFA status for current user' })
  @ApiResponse({
    status: 200,
    description: 'MFA status',
  })
  async getMfaStatus(@Request() req): Promise<{
    enabled: boolean;
    backupCodesRemaining: number;
  }> {
    const enabled = await this.mfaService.isMfaEnabled(req.user.id);
    const backupCodesRemaining = enabled
      ? await this.mfaService.getBackupCodesCount(req.user.id)
      : 0;

    return {
      enabled,
      backupCodesRemaining,
    };
  }

  @Post('setup')
  @ApiOperation({ summary: 'Generate MFA secret and QR code for setup' })
  @ApiResponse({
    status: 200,
    description: 'MFA setup data with QR code',
  })
  @ApiResponse({
    status: 400,
    description: 'MFA already enabled',
  })
  async setupMfa(@Request() req): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }> {
    return this.mfaService.generateSecret(req.user.id);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable MFA by verifying a TOTP token' })
  @ApiResponse({
    status: 200,
    description: 'MFA enabled, returns backup codes',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async enableMfa(
    @Request() req,
    @Body() dto: VerifyMfaDto,
    @Ip() ipAddress: string,
  ): Promise<{
    message: string;
    backupCodes: string[];
  }> {
    const { backupCodes } = await this.mfaService.enableMfa(
      req.user.id,
      dto.token,
    );

    await this.securityService.logMfaEnabled(req.user.id, ipAddress);

    return {
      message: 'MFA enabled successfully. Save your backup codes securely.',
      backupCodes,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a TOTP token (for login or confirmation)' })
  @ApiResponse({
    status: 200,
    description: 'Token verified successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async verifyMfa(
    @Request() req,
    @Body() dto: VerifyMfaDto,
    @Ip() ipAddress: string,
  ): Promise<{ verified: boolean }> {
    const verified = await this.mfaService.verifyMfaToken(
      req.user.id,
      dto.token,
    );

    if (verified) {
      await this.securityService.logMfaVerified(req.user.id, ipAddress);
    } else {
      await this.securityService.logMfaFailed(req.user.id, ipAddress);
    }

    return { verified };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA for current user' })
  @ApiResponse({
    status: 200,
    description: 'MFA disabled successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async disableMfa(
    @Request() req,
    @Body() dto: VerifyMfaDto,
    @Ip() ipAddress: string,
  ): Promise<{ message: string }> {
    await this.mfaService.disableMfa(req.user.id, dto.token);
    await this.securityService.logMfaDisabled(req.user.id, ipAddress);

    return { message: 'MFA disabled successfully' };
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiResponse({
    status: 200,
    description: 'New backup codes generated',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async regenerateBackupCodes(
    @Request() req,
    @Body() dto: VerifyMfaDto,
  ): Promise<{
    message: string;
    backupCodes: string[];
  }> {
    const { backupCodes } = await this.mfaService.regenerateBackupCodes(
      req.user.id,
      dto.token,
    );

    return {
      message: 'Backup codes regenerated. Save them securely.',
      backupCodes,
    };
  }
}
