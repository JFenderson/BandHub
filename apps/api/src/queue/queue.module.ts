import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueName } from '@hbcu-band-hub/shared-types';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  imports: [
    // BullMQ configuration - same as worker
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    
    // Register queues for job creation
    BullModule.registerQueue(
      { name: QueueName.VIDEO_SYNC },
      { name: QueueName.VIDEO_PROCESSING },
      { name: QueueName.MAINTENANCE }
    ),
  ],
  providers: [QueueService],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}