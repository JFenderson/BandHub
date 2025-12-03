import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module'; // Add this
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { HealthService } from './health.service';

@Module({
  imports: [DatabaseModule, CacheModule, QueueModule], // Add DatabaseModule
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}