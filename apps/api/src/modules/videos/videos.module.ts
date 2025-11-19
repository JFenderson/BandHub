import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideosRepository } from './videos.repository';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [VideosController],
  providers: [VideosService, VideosRepository],
  exports: [VideosService, VideosRepository],
})
export class VideosModule {}