import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { BandsModule } from './modules/bands/bands.module';
import { VideosModule } from './modules/videos/videos.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './health/health.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    // Configuration - loads .env variables
    ConfigModule.forRoot({
      isGlobal: true, // Available everywhere without importing
      envFilePath: '../../.env', // Path relative to apps/api
    }),

    // Core infrastructure
    DatabaseModule,
    CacheModule,
    QueueModule,

    // Feature modules
    BandsModule,
    VideosModule,
    CategoriesModule,
    SearchModule,
    AdminModule,
 SyncModule,
    // Utilities
    HealthModule,
  ],
})
export class AppModule {}