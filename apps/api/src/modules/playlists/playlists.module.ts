import { Module } from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController, ShareController } from './playlists.controller';
import { PrismaModule } from '@bandhub/database';

@Module({
  imports: [PrismaModule],
  controllers: [PlaylistsController, ShareController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
