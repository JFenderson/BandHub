import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { AchievementTrackerService } from './achievement-tracker.service';
import { LeaderboardService } from './leaderboard.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [AchievementsController],
  providers: [
    AchievementsService,
    AchievementTrackerService,
    LeaderboardService,
  ],
  exports: [
    AchievementsService,
    AchievementTrackerService,
    LeaderboardService,
  ],
})
export class AchievementsModule {}
