import { Module, forwardRef } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaModule } from '@bandhub/database';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AchievementsModule)],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
