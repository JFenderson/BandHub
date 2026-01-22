import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '@hbcu-band-hub/shared-types';
import { PrismaModule } from '@bandhub/database';
import { QueueService } from './queue.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: QueueName.VIDEO_SYNC },
      { name: QueueName.VIDEO_PROCESSING },
      { name: QueueName.MAINTENANCE },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
