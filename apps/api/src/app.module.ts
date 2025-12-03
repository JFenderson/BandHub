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
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EmailModule } from './modules/email/email.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { SyncModule } from './modules/sync/sync.module';
import { YoutubeModule } from './youtube/youtube.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CreatorsModule } from './modules/creators/creators.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '../../.env', // Root . env for monorepo
        '. env', // Fallback to local .env if exists
      ],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100, // Global limit: 100 requests per minute
      },
    ]),
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
    AuthModule,
    UsersModule,
    EmailModule,
    FavoritesModule,
    NotificationsModule,
    SyncModule,
    YoutubeModule,
    CreatorsModule,
    // Utilities
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply rate limiting globally
    },
    // ... other providers
  ],
})
export class AppModule {}
