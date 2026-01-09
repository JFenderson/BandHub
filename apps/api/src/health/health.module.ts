import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '@bandhub/database';
import { CacheModule } from '@bandhub/cache';
import { QueueModule } from '../queue/queue.module';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, CacheModule, QueueModule], // Add PrismaModule
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}