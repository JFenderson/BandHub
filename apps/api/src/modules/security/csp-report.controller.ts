/**
 * CSP Report Controller
 * 
 * Handles Content Security Policy violation reports.
 * Browsers send POST requests to this endpoint when CSP violations occur.
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PrismaService } from '@bandhub/database';
import { SkipRateLimit } from '../../common/decorators/rate-limit.decorator';

interface CspReport {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'status-code'?: number;
  };
}

@ApiTags('Security')
@Controller({ path: 'csp-report', version: '1' })
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipRateLimit()
  @ApiExcludeEndpoint() // Hide from Swagger docs
  @ApiOperation({ summary: 'Receive CSP violation reports' })
  @ApiResponse({ status: 204, description: 'Report received' })
  async handleCspReport(@Body() report: CspReport) {
    if (!report || !report['csp-report']) {
      return;
    }

    const cspReport = report['csp-report'];
    
    // Log CSP violation
    this.logger.warn('CSP Violation Detected', {
      documentUri: cspReport['document-uri'],
      violatedDirective: cspReport['violated-directive'],
      effectiveDirective: cspReport['effective-directive'],
      blockedUri: cspReport['blocked-uri'],
      sourceFile: cspReport['source-file'],
      lineNumber: cspReport['line-number'],
      columnNumber: cspReport['column-number'],
    });

    // Persist to AuditLog for trend analysis
    await this.prisma.auditLog.create({
      data: {
        action: 'CSP_VIOLATION',
        entityType: 'csp',
        entityId: cspReport['document-uri'] || 'unknown',
        severity: 'warn',
        changes: {
          violatedDirective: cspReport['violated-directive'],
          effectiveDirective: cspReport['effective-directive'],
          blockedUri: cspReport['blocked-uri'],
          sourceFile: cspReport['source-file'],
          lineNumber: cspReport['line-number'],
          columnNumber: cspReport['column-number'],
          statusCode: cspReport['status-code'],
        },
      },
    }).catch((err) => this.logger.error('Failed to persist CSP violation', err));

    return; // Return 204 No Content
  }
}
