import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '@hbcu-band-hub/observability';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return registry.metrics();
  }
}
