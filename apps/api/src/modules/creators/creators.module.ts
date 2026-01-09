import { Module } from '@nestjs/common';
import { CreatorsController, AdminCreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { PrismaModule } from '@bandhub/database';
import { VideosModule } from '../videos/videos.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [PrismaModule, VideosModule, SyncModule],
  controllers: [CreatorsController, AdminCreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
