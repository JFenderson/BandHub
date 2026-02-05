import { Module, forwardRef } from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';
import { PrismaModule } from '@bandhub/database';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AchievementsModule)],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
