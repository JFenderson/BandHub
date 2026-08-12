
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsModule } from './metrics/metrics.module';
import { QueueName } from '@hbcu-band-hub/shared-types';
// Shared packages
import { PrismaModule } from '@bandhub/database';
import { DatabaseService } from './services/database.service';
import { CacheModule } from '@bandhub/cache';
// Queue module with priority support
import { QueueModule } from './queue/queue.module';
// Worker services
import { YouTubeService } from './services/youtube.service';
import { CircuitBreakerService } from './external/circuit-breaker.service';
// Processors
import { SyncBandHandler } from './processors/sync-band.processor';
import { SyncAllBandsHandler } from './processors/sync-all-bands.processor';
import { ProcessVideoHandler } from './processors/process-video.processor';
import { CleanupHandler } from './processors/cleanup.processor';
import { NotificationHandler } from './processors/notification.processor';
import { BackfillCreatorsHandler } from './processors/backfill-creators.processor';
import { BackfillBandsHandler } from './processors/backfill-bands.processor';
import { MatchVideosHandler } from './processors/match-videos.processor';
import { PromoteVideosHandler } from './processors/promote-videos.processor';
import { BackfillCategoriesHandler } from './processors/backfill-categories.processor';
import { ClassifyVideosHandler } from './processors/classify-videos.processor';
import { RematchVideosHandler } from './processors/rematch-videos.processor';
import { VideoProcessingQueueProcessor } from './processors/video-processing-queue.processor';
import { VideoSyncQueueProcessor } from './processors/video-sync-queue.processor';
import { MaintenanceQueueProcessor } from './processors/maintenance-queue.processor';
import { BandLibrarianService } from './services/band-librarian.service';
// Scheduler
import { SyncScheduler } from './scheduler/sync.scheduler';

@Module({
imports: [
// Load environment variables
ConfigModule.forRoot({
isGlobal: true,
envFilePath: ['.env.local', '.env'],
}),
// Shared modules
PrismaModule,
CacheModule,

// Enable scheduled jobs
ScheduleModule.forRoot(),

// Worker metrics (exposes /metrics on configured port)
MetricsModule,

// Queue module with priority-based job processing
QueueModule,

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
        delay: 10000, // 10 seconds
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 86400, // Or jobs from last 24 hours
      },
      removeOnFail: {
        count: 500, // Keep more failed jobs for debugging
        age: 604800, // 7 days
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
        delay: 30000, // Longer delay for sync jobs
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
      attempts: 1, // Don't retry maintenance jobs
    },
  },
),
],
providers: [
// Services
DatabaseService,
YouTubeService,
CircuitBreakerService,
BandLibrarianService,
// Processors
SyncBandHandler,
SyncAllBandsHandler,
ProcessVideoHandler,
CleanupHandler,
NotificationHandler,
BackfillCreatorsHandler,
BackfillBandsHandler,
MatchVideosHandler,
PromoteVideosHandler,
BackfillCategoriesHandler,
ClassifyVideosHandler,
RematchVideosHandler,
VideoProcessingQueueProcessor,
VideoSyncQueueProcessor,
MaintenanceQueueProcessor,

// Scheduler
SyncScheduler,
],
})
export class WorkerModule {}
