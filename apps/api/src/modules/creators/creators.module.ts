import { Module } from '@nestjs/common';
import { CreatorsController, AdminCreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { DatabaseModule } from '../../database/database.module';
import { VideosModule } from '../videos/videos.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [DatabaseModule, VideosModule, SyncModule],
  controllers: [CreatorsController, AdminCreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
