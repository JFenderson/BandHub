import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideosRepository } from './videos.repository';
import { TrendingController } from './controllers/trending.controller';
import { TrendingService } from './services/trending.service';
import { TrendingScheduler } from './services/trending.scheduler';
import { PrismaModule } from '@bandhub/database';
import { CacheModule } from '@bandhub/cache';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [VideosController, TrendingController],
  providers: [VideosService, VideosRepository, TrendingService, TrendingScheduler],
  exports: [VideosService, VideosRepository, TrendingService],
})
export class VideosModule {}