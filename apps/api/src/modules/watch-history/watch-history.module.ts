import { Module, forwardRef } from '@nestjs/common';
import { WatchHistoryController } from './watch-history.controller';
import { WatchHistoryService } from './watch-history.service';
import { PrismaModule } from '@bandhub/database';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AchievementsModule)],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
  exports: [WatchHistoryService],
})
export class WatchHistoryModule {}
