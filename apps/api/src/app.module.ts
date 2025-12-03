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
import { MetricsModule } from './metrics/metrics.module';
import { SyncModule } from './modules/sync/sync.module';
import { YoutubeModule } from './youtube/youtube.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ObservabilityModule } from './observability/observability.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { SecretsModule } from './modules/secrets-manager/secrets.module';
import { AppConfigModule } from './modules/config/config.module';

@Module({
  imports: [
    // Configuration with validation (replaces basic ConfigModule.forRoot)
    AppConfigModule,
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
    SecretsModule, // Centralized secrets management
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
    MetricsModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply rate limiting globally
    },
    // Metrics interceptor provided by MetricsModule (registered globally there)
    // ... other providers
  ],
})
export class AppModule {}
