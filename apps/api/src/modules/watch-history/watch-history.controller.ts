import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WatchHistoryService } from './watch-history.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import { TrackWatchDto, GetWatchHistoryQueryDto } from './dto';

@ApiTags('watch-history')
@Controller('watch-history')
@UseGuards(UserAuthGuard)
@ApiBearerAuth()
export class WatchHistoryController {
  constructor(private readonly watchHistoryService: WatchHistoryService) {}

  @Post('track')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a watch event' })
  @ApiResponse({ status: 200, description: 'Watch event tracked successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async trackWatch(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: TrackWatchDto,
  ) {
    return this.watchHistoryService.trackWatch(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get watch history' })
  @ApiResponse({ status: 200, description: 'Watch history retrieved successfully' })
  async getHistory(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetWatchHistoryQueryDto,
  ) {
    return this.watchHistoryService.getHistory(user.userId, query);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all watch history' })
  @ApiResponse({ status: 200, description: 'Watch history cleared successfully' })
  async clearAllHistory(@CurrentUser() user: CurrentUserData) {
    return this.watchHistoryService.clearHistory(user.userId);
  }

  @Delete(':videoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear specific video from watch history' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video removed from watch history' })
  @ApiResponse({ status: 404, description: 'Video not found in watch history' })
  async clearVideoHistory(
    @CurrentUser() user: CurrentUserData,
    @Param('videoId') videoId: string,
  ) {
    return this.watchHistoryService.clearHistory(user.userId, videoId);
  }

  @Get('recently-watched')
  @ApiOperation({ summary: 'Get recently watched videos' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of videos to return (default: 10)' })
  @ApiResponse({ status: 200, description: 'Recently watched videos retrieved successfully' })
  async getRecentlyWatched(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: number,
  ) {
    return this.watchHistoryService.getRecentlyWatched(
      user.userId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('continue-watching')
  @ApiOperation({ summary: 'Get videos to continue watching' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of videos to return (default: 10)' })
  @ApiResponse({ status: 200, description: 'Continue watching videos retrieved successfully' })
  async getContinueWatching(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: number,
  ) {
    return this.watchHistoryService.getContinueWatching(
      user.userId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get watch statistics' })
  @ApiResponse({ status: 200, description: 'Watch statistics retrieved successfully' })
  async getWatchStats(@CurrentUser() user: CurrentUserData) {
    return this.watchHistoryService.getWatchStats(user.userId);
  }
}
