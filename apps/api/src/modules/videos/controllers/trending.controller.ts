import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TrendingService, TrendingTimeframe, TrendingVideo } from '../services/trending.service';

@ApiTags('Videos')
@Controller({ path: 'videos/trending', version: '1' })
export class TrendingController {
  constructor(private readonly trendingService: TrendingService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trending videos',
    description: 'Retrieve trending videos based on weighted scoring algorithm with time decay. ' +
      'Score = (recentViews * 0.4) + (recency * 0.3) + (quality * 0.2) + (engagement * 0.1)',
  })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['today', 'week', 'month', 'all-time'],
    description: 'Time window for trending calculation',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by category slug (e.g., halftime, fifth-quarter)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of videos to return (default: 20, max: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trending videos retrieved successfully',
  })
  async getTrendingVideos(
    @Query('timeframe') timeframe?: TrendingTimeframe,
    @Query('category') categorySlug?: string,
    @Query('limit') limit?: string,
  ): Promise<TrendingVideo[]> {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 20;

    return this.trendingService.getTrendingVideos({
      timeframe: timeframe || 'week',
      categorySlug,
      limit: parsedLimit,
    });
  }
}
