/**
 * Security Module
 * 
 * Handles security-related functionality including:
 * - CSP violation reporting
 * - Security headers configuration
 */

import { Module } from '@nestjs/common';
import { CspReportController } from './csp-report.controller';

@Module({
  controllers: [CspReportController],
  providers: [],
  exports: [],
})
export class SecurityModule {}
