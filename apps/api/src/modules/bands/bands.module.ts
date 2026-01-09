import { Module } from '@nestjs/common';
import { BandsService } from './services/bands.service';
import { BandsController } from './controllers/bands.controller';
import { FeaturedRecommendationsService } from './services/featured-recommendations.service';
import { TrendingService } from './services/trending.service';
import { TrendingController } from './controllers/trending.controller';
import { PrismaModule } from '@bandhub/database';
import { CacheModule } from '@bandhub/cache';
import { BandsRepository } from './bands.repository';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [BandsController, TrendingController],
  providers: [
    BandsService,
    FeaturedRecommendationsService,
    TrendingService,
    BandsRepository,
  ],
  exports: [BandsService, TrendingService],
})
export class BandsModule {}