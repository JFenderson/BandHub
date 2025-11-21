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
import { BandsSeedService } from './database/seeds/bands.seed';
import { CategoriesSeedService } from './database/seeds/categories.seed';
import { PrismaModule } from '@hbcu-band-hub/prisma';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Core infrastructure
    DatabaseModule,
    CacheModule,
    QueueModule,
PrismaModule,
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
    providers: [
    CategoriesSeedService, // ← It should be here, not in imports
    // ... other providers
  ],
})
export class AppModule {}