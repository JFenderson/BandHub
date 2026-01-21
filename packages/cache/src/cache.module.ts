import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CacheCompressionService } from './cache-compression.service';
import { CacheStrategyService } from './cache-strategy.service';
import { CacheWarmingService } from './cache-warming.service';
import { CacheTaggingService } from './cache-tagging.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CacheService,              // Low-level Redis client
    CacheCompressionService,   // Compression utilities
    CacheTaggingService,       // Tag-based invalidation
    CacheStrategyService,      // Main caching orchestrator
    CacheWarmingService,       // Cache warming on startup
  ],
  exports: [
    CacheService,
    CacheStrategyService,
    CacheCompressionService,
    CacheWarmingService,
    CacheTaggingService,
  ],
})
export class CacheModule {}