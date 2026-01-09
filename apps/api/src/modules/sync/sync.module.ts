import { Module } from '@nestjs/common';
import { SyncController, AdminSyncJobController, AdminQueueController, AdminSyncErrorController } from './sync.controller';
import { SyncService } from './sync.service';
import { QueueModule } from '../../queue/queue.module';
import { PrismaModule } from '@bandhub/database';
import { YoutubeModule } from '../../youtube/youtube.module'; // Add this

@Module({
  imports: [QueueModule, PrismaModule, YoutubeModule],
  controllers: [SyncController, AdminSyncJobController, AdminQueueController, AdminSyncErrorController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}