import { Module } from '@nestjs/common';
import { SyncController, AdminSyncJobController, AdminQueueController, AdminSyncErrorController } from './sync.controller';
import { SyncService } from './sync.service';
import { QueueModule } from '../../queue/queue.module';
import { DatabaseModule } from '../../database/database.module';
import { YoutubeModule } from '../../youtube/youtube.module'; // Add this

@Module({
  imports: [QueueModule, DatabaseModule, YoutubeModule],
  controllers: [SyncController, AdminSyncJobController, AdminQueueController, AdminSyncErrorController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}