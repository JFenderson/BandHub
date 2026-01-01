import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { DatabaseModule } from '../database/database.module';
import { CacheCompressionService } from './cache-compression.service';
import { CacheStrategyService } from './cache-strategy.service';
import { CacheWarmingService } from './cache-warming.service';

@Global()
@Module({ 
  imports: [DatabaseModule], // Needed for CacheWarmingService
    providers: [
    CacheService,              // Low-level Redis client
    CacheCompressionService,   // Compression utilities
    CacheStrategyService,      // Main caching orchestrator
    CacheWarmingService,       // Cache warming on startup
  ],
  exports: [
    CacheService,
    CacheStrategyService,
    CacheCompressionService,
    CacheWarmingService,
  ],
})
export class CacheModule {}