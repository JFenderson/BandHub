import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { RequestObserverInterceptor } from '@hbcu-band-hub/observability';

@Module({
  controllers: [MetricsController],
  providers: [
  ],
})
export class ObservabilityModule {}
