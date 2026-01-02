import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { YoutubeService } from './youtube.service';
import { YoutubeSyncService } from './youtube-sync.service';
import { YoutubeSyncScheduler } from './youtube-sync.scheduler';
import { YoutubeQuotaService } from './youtube-quota.service'; // NEW
import { YoutubeQuotaController } from './youtube-quota.controller'; // NEW
import { SyncAdminController } from './sync-admin.controller';
import { YouTubeAdminController } from './youtube-admin.controller';
import { YouTubeVideoRepository } from './youtube-video.repository';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module'; // NEW: Needed for quota service

/**
 * YouTube Module - UPDATED with Quota Management
 * 
 * File: apps/api/src/youtube/youtube.module.ts (UPDATED)
 * 
 * Changes:
 * 1. Added YoutubeQuotaService provider
 * 2. Added YoutubeQuotaController for admin dashboard
 * 3. Imported CacheModule for Redis-based quota tracking
 * 4. Exported quota service for use in other modules if needed
 * 
 * The module now provides comprehensive quota management alongside
 * the existing YouTube sync functionality.
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    CacheModule, // NEW: Required for quota tracking
  ],
  controllers: [
    SyncAdminController,
    YouTubeAdminController,
    YoutubeQuotaController, // NEW: Quota management endpoints
  ],
  providers: [
    YoutubeService,
    YoutubeSyncService,
    YoutubeSyncScheduler,
    YouTubeVideoRepository,
    YoutubeQuotaService, // NEW: Core quota management service
  ],
  exports: [
    YoutubeService,
    YoutubeSyncService,
    YoutubeSyncScheduler,
    YouTubeVideoRepository,
    YoutubeQuotaService, // NEW: Export for use in other modules
  ],
})
export class YoutubeModule {}