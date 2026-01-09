import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TrendingMetricsScheduler implements OnModuleInit {
  private readonly logger = new Logger(TrendingMetricsScheduler.name);

  constructor(
    @InjectQueue('trending-metrics')
    private readonly trendingQueue: Queue,
  ) {}

  async onModuleInit() {
    // Schedule job to run every hour
    await this.trendingQueue.add(
      'update-trending',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log('Trending metrics job scheduled (every hour)');
  }
}