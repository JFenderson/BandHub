import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { YoutubeService } from './youtube.service';
import { YoutubeSyncService } from './youtube-sync.service';
import { YoutubeSyncScheduler } from './youtube-sync.scheduler';
import { SyncAdminController } from './sync-admin.controller';
import { YouTubeAdminController } from './youtube-admin.controller';
import { YouTubeVideoRepository } from './youtube-video.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  controllers: [SyncAdminController, YouTubeAdminController],
  providers: [
    YoutubeService,
    YoutubeSyncService,
    YoutubeSyncScheduler,
    YouTubeVideoRepository,
  ],
  exports: [YoutubeService, YoutubeSyncService, YoutubeSyncScheduler, YouTubeVideoRepository],
})
export class YoutubeModule {}
