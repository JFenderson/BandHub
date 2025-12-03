import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
