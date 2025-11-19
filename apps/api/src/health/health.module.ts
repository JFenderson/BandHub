import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module'; // Add this
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule], // Add DatabaseModule
  controllers: [HealthController],
})
export class HealthModule {}