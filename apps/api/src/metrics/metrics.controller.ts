import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '@hbcu-band-hub/observability';
import { SkipRateLimit } from '../common/decorators/rate-limit.decorator';

/**
 * Metrics Controller
 * 
 * Exposes Prometheus metrics for monitoring.
 * Rate limiting is skipped to ensure Prometheus can always scrape metrics.
 */
@Controller({ path: 'metrics', version: '1' })
@SkipRateLimit() // Skip rate limiting for metrics endpoint
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return registry.metrics();
  }
}