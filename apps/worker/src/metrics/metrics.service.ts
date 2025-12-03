import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';
import http from 'http';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private registry = new client.Registry();
  private server: http.Server | null = null;

  // Basic metrics
  public youtubeApiCalls = new client.Counter({
    name: 'worker_youtube_api_calls_total',
    help: 'Total YouTube API calls made by the worker',
    labelNames: ['endpoint'],
    registers: [this.registry],
  });

  public youtubeCallsInProgress = new client.Gauge({
    name: 'worker_youtube_calls_in_progress',
    help: 'In-progress YouTube API calls',
    registers: [this.registry],
  });

  public youtubeCircuitOpen = new client.Counter({
    name: 'worker_youtube_circuit_open_total',
    help: 'Times the YouTube circuit opened',
    registers: [this.registry],
  });

  constructor(private configService: ConfigService) {
    // collect default nodejs metrics
    client.collectDefaultMetrics({ register: this.registry });

    // Start an HTTP server only if a port is configured (or default)
    const port = this.configService.get<number>('WORKER_METRICS_PORT', 9400);
    const enabled = this.configService.get<string>('ENABLE_WORKER_METRICS', 'true') === 'true';

    if (enabled) {
      this.startServer(port).catch((err) =>
        this.logger.error('Failed to start metrics server', err),
      );
    }
  }

  private async startServer(port: number) {
    this.server = http.createServer(async (req, res) => {
      if (!req.url) return res.end('');
      if (req.url === '/metrics') {
        try {
          const metrics = await this.registry.metrics();
          res.setHeader('Content-Type', this.registry.contentType);
          res.writeHead(200);
          res.end(metrics);
        } catch (err) {
          res.writeHead(500);
          res.end('error');
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, () => {
        this.logger.log(`Worker metrics server listening on :${port}`);
        resolve();
      });

      this.server!.on('error', (err) => reject(err));
    });
  }

  // Convenience helpers
  incrementYouTube(endpoint: string) {
    this.youtubeApiCalls.inc({ endpoint });
  }

  startYouTubeCall() {
    this.youtubeCallsInProgress.inc();
  }

  endYouTubeCall() {
    this.youtubeCallsInProgress.dec();
  }

  recordCircuitOpen() {
    this.youtubeCircuitOpen.inc();
  }

  onModuleDestroy() {
    if (this.server) {
      this.logger.log('Shutting down worker metrics server');
      this.server.close(() => this.logger.log('Metrics server closed'));
    }
  }
}
