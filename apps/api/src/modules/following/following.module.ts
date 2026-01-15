import { Module } from '@nestjs/common';
import { PrismaModule } from '@bandhub/database';
import { FollowingService } from './services/following.service';
import { FollowingController } from './controllers/following.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FollowingController],
  providers: [FollowingService],
  exports: [FollowingService],
})
export class FollowingModule {}
