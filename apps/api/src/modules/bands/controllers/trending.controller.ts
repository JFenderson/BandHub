import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrendingService } from '../services/trending.service';
import { OptionalAuthGuard } from '../../../common/guards/optional-auth.guard';
import { CurrentUser, CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '@bandhub/database';

@Controller('bands/trending')
export class TrendingController {
  constructor(
    private readonly trendingService: TrendingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  async getTrending(
    @Query('timeframe') timeframe?: 'today' | 'week' | 'month' | 'all-time',
    @Query('state') state?: string,
    @Query('conference') conference?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.trendingService.getTrendingBands({
      timeframe,
      state,
      conference,
      category,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post(':bandId/favorite')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async favoriteBand(
    @Param('bandId') bandId: string,
    @CurrentUser() user: any,
  ) {
    if (!user) {
      throw new Error('Authentication required');
    }

    return this.prisma.userBandFavorite.create({
      data: {
        userId: user.id,
        bandId,
      },
    });
  }

  @Delete(':bandId/favorite')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfavoriteBand(
    @Param('bandId') bandId: string,
    @CurrentUser() user: any,
  ) {
    if (!user) {
      throw new Error('Authentication required');
    }

    await this.prisma.userBandFavorite.deleteMany({
      where: {
        userId: user.id,
        bandId,
      },
    });
  }

  @Post(':bandId/share')
  @HttpCode(HttpStatus.CREATED)
  async shareBand(
    @Param('bandId') bandId: string,
    @Query('platform') platform: string,
    @CurrentUser() user?: any,
  ) {
    return this.prisma.bandShare.create({
      data: {
        bandId,
        platform,
        userId: user?.id,
      },
    });
  }
}