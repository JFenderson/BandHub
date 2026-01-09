import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideosRepository } from './videos.repository';
import { PrismaModule } from '@bandhub/database';
import { CacheModule } from '@bandhub/cache';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [VideosController],
  providers: [VideosService, VideosRepository],
  exports: [VideosService, VideosRepository],
})
export class VideosModule {}