import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueName } from '@hbcu-band-hub/shared/types';
import { PrismaModule } from '@hbcu-band-hub/prisma';

// Services
import { YouTubeService } from './services/youtube.service';
import { DatabaseService } from './services/database.service';

// Processors
import { SyncBandProcessor } from './processors/sync-band.processor';
import { SyncAllBandsProcessor } from './processors/sync-all-bands.processor';
import { ProcessVideoProcessor } from './processors/process-video.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

// Scheduler
import { SyncScheduler } from './scheduler/sync.scheduler';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    
    // Database
    PrismaModule,
    
    // Enable scheduled jobs
    ScheduleModule.forRoot(),
    
    // BullMQ configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          // Default settings for all jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,  // 10 seconds
          },
          removeOnComplete: {
            count: 100,     // Keep last 100 completed jobs
            age: 86400,     // Or jobs from last 24 hours
          },
          removeOnFail: {
            count: 500,     // Keep more failed jobs for debugging
            age: 604800,    // 7 days
          },
        },
      }),
      inject: [ConfigService],
    }),
    
    // Register queues
    BullModule.registerQueue(
      {
        name: QueueName.VIDEO_SYNC,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,  // Longer delay for sync jobs
          },
        },
      },
      {
        name: QueueName.VIDEO_PROCESSING,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        },
      },
      {
        name: QueueName.MAINTENANCE,
        defaultJobOptions: {
          attempts: 1,  // Don't retry maintenance jobs
        },
      }
    ),
  ],
  providers: [
    // Services
    YouTubeService,
    DatabaseService,
    
    // Processors
    SyncBandProcessor,
    SyncAllBandsProcessor,
    ProcessVideoProcessor,
    CleanupProcessor,
    
    // Scheduler
    SyncScheduler,
  ],
})
export class WorkerModule {}