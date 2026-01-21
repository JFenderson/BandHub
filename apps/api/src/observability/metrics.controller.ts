import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '@hbcu-band-hub/observability';

@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return registry.metrics();
  }
}
