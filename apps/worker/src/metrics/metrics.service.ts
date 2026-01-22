import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as client from 'prom-client';
import http from 'http';
import { QueueName, JobPriority } from '@hbcu-band-hub/shared-types';

@Injectable()
export class MetricsService implements OnModuleDestroy, OnModuleInit {
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

  // Priority distribution metrics
  public queueJobsByPriority = new client.Gauge({
    name: 'worker_queue_jobs_by_priority',
    help: 'Number of jobs in queue by priority level',
    labelNames: ['queue', 'priority', 'state'],
    registers: [this.registry],
  });

  public queuePriorityPercentage = new client.Gauge({
    name: 'worker_queue_priority_percentage',
    help: 'Percentage of jobs by priority level',
    labelNames: ['queue', 'priority'],
    registers: [this.registry],
  });

  constructor(
    private configService: ConfigService,
    @InjectQueue(QueueName.VIDEO_SYNC)
    private videoSyncQueue: Queue,
    @InjectQueue(QueueName.VIDEO_PROCESSING)
    private videoProcessingQueue: Queue,
    @InjectQueue(QueueName.MAINTENANCE)
    private maintenanceQueue: Queue,
  ) {
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

  async onModuleInit() {
    // Update priority metrics every 30 seconds
    setInterval(() => this.updatePriorityMetrics(), 30000);
    // Initial update
    await this.updatePriorityMetrics();
  }

  /**
   * Update priority distribution metrics
   */
  async updatePriorityMetrics(): Promise<void> {
    const queues = [
      { queue: this.videoSyncQueue, name: QueueName.VIDEO_SYNC },
      { queue: this.videoProcessingQueue, name: QueueName.VIDEO_PROCESSING },
      { queue: this.maintenanceQueue, name: QueueName.MAINTENANCE },
    ];

    for (const { queue, name } of queues) {
      try {
        const [waiting, active, delayed] = await Promise.all([
          queue.getWaiting(0, 1000),
          queue.getActive(0, 100),
          queue.getDelayed(0, 1000),
        ]);

        // Calculate distribution for each state
        const states = [
          { jobs: waiting, state: 'waiting' },
          { jobs: active, state: 'active' },
          { jobs: delayed, state: 'delayed' },
        ];

        const priorityNames = ['critical', 'high', 'normal', 'low'];

        for (const { jobs, state } of states) {
          const distribution = this.calculatePriorityDistribution(jobs);

          this.queueJobsByPriority.set({ queue: name, priority: 'critical', state }, distribution.critical);
          this.queueJobsByPriority.set({ queue: name, priority: 'high', state }, distribution.high);
          this.queueJobsByPriority.set({ queue: name, priority: 'normal', state }, distribution.normal);
          this.queueJobsByPriority.set({ queue: name, priority: 'low', state }, distribution.low);
        }

        // Calculate total percentage for the queue
        const allJobs = [...waiting, ...active, ...delayed];
        const totalDistribution = this.calculatePriorityDistribution(allJobs);
        const total = totalDistribution.total || 1;

        for (const priority of priorityNames) {
          const count = totalDistribution[priority as keyof typeof totalDistribution] as number;
          this.queuePriorityPercentage.set(
            { queue: name, priority },
            Math.round((count / total) * 100),
          );
        }
      } catch (error) {
        this.logger.error(`Failed to update priority metrics for queue ${name}`, error);
      }
    }
  }

  /**
   * Calculate priority distribution from a list of jobs
   */
  private calculatePriorityDistribution(jobs: any[]): {
    critical: number;
    high: number;
    normal: number;
    low: number;
    total: number;
  } {
    const distribution = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      total: jobs.length,
    };

    for (const job of jobs) {
      const priority = job.opts?.priority || JobPriority.NORMAL;

      if (priority <= JobPriority.CRITICAL) {
        distribution.critical++;
      } else if (priority <= JobPriority.HIGH) {
        distribution.high++;
      } else if (priority <= JobPriority.NORMAL) {
        distribution.normal++;
      } else {
        distribution.low++;
      }
    }

    return distribution;
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
