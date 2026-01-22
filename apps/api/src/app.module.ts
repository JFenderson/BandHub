import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database/database.service';
import { QueueModule } from './queue/queue.module';
import { BandsModule } from './modules/bands/bands.module';
import { VideosModule } from './modules/videos/videos.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { EventsModule } from './modules/events/events.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EmailModule } from './modules/email/email.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FollowingModule } from './modules/following/following.module';
import { WatchHistoryModule } from './modules/watch-history/watch-history.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { SyncModule } from './modules/sync/sync.module';
import { YoutubeModule } from './youtube/youtube.module';
import { SecurityModule } from './modules/security/security.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityModule } from './observability/observability.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { SecretsModule } from './modules/secrets-manager/secrets.module';
import { AppConfigModule } from './modules/config/config.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RateLimitingGuard } from './common/guards/rate-limiting.guard';
import { RedisRateLimiterService } from './common/services/redis-rate-limiter.service';
import { RateLimitExceptionFilter } from './common/filters/rate-limit-exception.filter';
import { IpExtractorMiddleware } from './common/middleware/ip-extractor.middleware';
import Redis from 'ioredis';
import { Reflector } from '@nestjs/core/services/reflector.service';
import { PrismaModule } from '@bandhub/database'; // From shared package
import { CacheModule } from '@bandhub/cache'; // From shared package
import { MetricsService } from './metrics/metrics.service';

@Module({
  imports: [
    // Configuration with validation (replaces basic ConfigModule.forRoot)
    AppConfigModule,
    ScheduleModule.forRoot(),
    
    // Configure ThrottlerModule with Redis storage for distributed rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute window
            limit: 100, // 100 requests per minute (fallback if custom limits not set)
          },
        ],
        // Use Redis for distributed rate limiting across multiple API instances
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            db: 1, // Use separate database for rate limiting
            maxRetriesPerRequest: null,
          }),
        ),
      }),
    }),
    
    // Core infrastructure
    PrismaModule,
    CacheModule,
    QueueModule,
    SecretsModule, // Centralized secrets management
    
    // Feature modules
    BandsModule,
    VideosModule,
    CategoriesModule,
    EventsModule,
    SearchModule,
    AdminModule,
    AuthModule,
    UsersModule,
    EmailModule,
    FavoritesModule,
    NotificationsModule,
    PlaylistsModule,
    CommentsModule,
    ReviewsModule,
    FollowingModule,
    WatchHistoryModule,
    SyncModule,
    YoutubeModule,
    CreatorsModule,
    SharingModule,
    SecurityModule,
    RecommendationsModule,
    
    // Utilities
    HealthModule,
    MetricsModule,
    ObservabilityModule,
  ],
providers: [
// API-specific database service with business logic
DatabaseService,
// Rate limiting service (used by guard)
RedisRateLimiterService,
{
  provide: APP_GUARD,, metrics: MetricsService) => {
    return new RateLimitingGuard(reflector, rateLimiter, metrics);
  },
  inject: [Reflector, RedisRateLimiterService, Metrics
  inject: [Reflector, RedisRateLimiterService],
},
    // Global filters
    {
      provide: APP_FILTER,
      useClass: RateLimitExceptionFilter, // Handle rate limit exceptions
    },
    
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // Apply comprehensive logging globally
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware
   * IP extractor must run before rate limiting to get real IP addresses
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IpExtractorMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}