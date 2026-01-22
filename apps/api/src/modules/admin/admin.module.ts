import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JobMonitoringController } from './controllers/job-monitoring.controller';
import { PrismaModule } from '@bandhub/database';
import { QUEUE_NAMES } from '@hbcu-band-hub/shared-types';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.YOUTUBE_SYNC },
      { name: QUEUE_NAMES.VIDEO_PROCESSING },
      { name: QUEUE_NAMES.MAINTENANCE },
    ),
  ],
  controllers: [AdminController, JobMonitoringController],
  providers: [AdminService],
})
export class AdminModule {}