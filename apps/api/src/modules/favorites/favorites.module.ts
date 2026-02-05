import { Module, forwardRef } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { UsersModule } from '../users/users.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [UsersModule, forwardRef(() => AchievementsModule)],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
