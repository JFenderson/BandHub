import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@bandhub/database';
import { FollowingService } from './services/following.service';
import { FollowingController } from './controllers/following.controller';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AchievementsModule)],
  controllers: [FollowingController],
  providers: [FollowingService],
  exports: [FollowingService],
})
export class FollowingModule {}
