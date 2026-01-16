import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import { GetRecommendationsQueryDto } from './dto/recommendations.dto';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('videos')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized video recommendations' })
  @ApiResponse({ status: 200, description: 'Personalized videos retrieved' })
  async getPersonalizedVideos(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetRecommendationsQueryDto,
  ) {
    return this.recommendationsService.getPersonalizedVideos(user.userId, query.limit);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending videos' })
  @ApiResponse({ status: 200, description: 'Trending videos retrieved' })
  async getTrendingVideos(@Query() query: GetRecommendationsQueryDto) {
    return this.recommendationsService.getTrendingVideos(query.limit);
  }

  @Get('videos/:id/similar')
  @ApiOperation({ summary: 'Get similar videos' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Similar videos retrieved' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getSimilarVideos(
    @Param('id') videoId: string,
    @Query() query: GetRecommendationsQueryDto,
  ) {
    return this.recommendationsService.getSimilarVideos(videoId, query.limit);
  }

  @Get('bands')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommended bands to follow' })
  @ApiResponse({ status: 200, description: 'Recommended bands retrieved' })
  async getRecommendedBands(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetRecommendationsQueryDto,
  ) {
    return this.recommendationsService.getRecommendedBands(user.userId, query.limit);
  }
}
