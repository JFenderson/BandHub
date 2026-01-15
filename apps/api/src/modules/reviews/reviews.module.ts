import { Module } from '@nestjs/common';
import { PrismaModule } from '@bandhub/database';
import { ReviewsService } from './services/reviews.service';
import { ReviewsController } from './controllers/reviews.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
