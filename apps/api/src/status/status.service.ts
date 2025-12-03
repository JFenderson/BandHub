import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Report a status change to a status page provider (placeholder).
   * If you use Statuspage.io, Cachet, or other providers, implement their API here.
   */
  async report(name: string, status: 'operational' | 'partial_outage' | 'major_outage' | 'degraded_performance', details?: any) {
    const webhook = this.config.get<string>('STATUS_PAGE_WEBHOOK');
    if (!webhook) {
      this.logger.debug('No status webhook configured; skipping report');
      return;
    }

    try {
      await fetch(webhook, { method: 'POST', body: JSON.stringify({ name, status, details }), headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      this.logger.error('Failed to report status', err as any);
    }
  }
}
