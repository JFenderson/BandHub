import { Injectable, OnModuleInit } from '@nestjs/common';
import client, { Registry, Histogram, Counter, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  public register: Registry;
  public httpRequestDuration: Histogram<string>;
  public httpRequestsTotal: Counter<string>;
  public activeHttpConnections: Gauge<string>;
  // Business metrics (placeholders)
  public videosSynced: Counter<string>;
  public userRegistrations: Counter<string>;
  // Compression metrics
  public compressedResponses: Counter<string>;
  public compressedBytes: Counter<string>;

  constructor() {
    this.register = new client.Registry();
    client.collectDefaultMetrics({ register: this.register });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 10],
      registers: [this.register],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.activeHttpConnections = new client.Gauge({
      name: 'active_http_connections',
      help: 'Active HTTP connections',
      registers: [this.register],
    });

    this.videosSynced = new client.Counter({
      name: 'business_videos_synced_total',
      help: 'Total videos synced',
      registers: [this.register],
    });

    this.userRegistrations = new client.Counter({
      name: 'business_user_registrations_total',
      help: 'Total user registrations',
      registers: [this.register],
    });

    // Compression metrics
    this.compressedResponses = new client.Counter({
      name: 'http_responses_compressed_total',
      help: 'Total number of compressed HTTP responses',
      labelNames: ['encoding'],
      registers: [this.register],
    });

    this.compressedBytes = new client.Counter({
      name: 'http_responses_compressed_bytes_total',
      help: 'Total bytes of compressed HTTP responses',
      registers: [this.register],
    });
  }

  onModuleInit() {
    // Optionally set a global prefix or other register configuration
    this.register.setDefaultLabels({ app: 'bandhub-api' });
  }

  metricsContentType() {
    return this.register.contentType;
  }

  async metrics() {
    return this.register.metrics();
  }
}
