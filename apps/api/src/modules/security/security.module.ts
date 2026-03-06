/**
 * Security Module
 * 
 * Handles security-related functionality including:
 * - CSP violation reporting
 * - Security headers configuration
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '@bandhub/database';
import { CspReportController } from './csp-report.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CspReportController],
  providers: [],
  exports: [],
})
export class SecurityModule {}
