/**
 * CSP Report Controller
 * 
 * Handles Content Security Policy violation reports.
 * Browsers send POST requests to this endpoint when CSP violations occur.
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
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

    // In production, you might want to:
    // 1. Store violations in database for analysis
    // 2. Send alerts for critical violations
    // 3. Track violation trends
    
    // TODO: Implement database storage and alerting if needed
    // await this.cspViolationService.store(cspReport);

    return; // Return 204 No Content
  }
}
