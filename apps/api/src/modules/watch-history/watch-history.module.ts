import { Module } from '@nestjs/common';
import { WatchHistoryController } from './watch-history.controller';
import { WatchHistoryService } from './watch-history.service';
import { PrismaModule } from '@bandhub/database';

@Module({
  imports: [PrismaModule],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
  exports: [WatchHistoryService],
})
export class WatchHistoryModule {}
