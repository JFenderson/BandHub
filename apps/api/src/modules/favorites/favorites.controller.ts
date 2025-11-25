import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import {
  AddFavoriteVideoDto,
  UpdateFavoriteVideoDto,
  GetFavoriteVideosQueryDto,
} from './dto/favorite-video.dto';
import {
  UpdateFavoriteBandDto,
  GetFavoriteBandsQueryDto,
} from './dto/favorite-band.dto';
import {
  UpdateWatchLaterDto,
  GetWatchLaterQueryDto,
} from './dto/watch-later.dto';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(UserAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  // ============ FAVORITE VIDEOS ============

  @Post('videos/:id')
  @ApiOperation({ summary: 'Add video to favorites' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 201, description: 'Video added to favorites' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 409, description: 'Video already in favorites' })
  async addFavoriteVideo(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
    @Body() dto: AddFavoriteVideoDto,
  ) {
    return this.favoritesService.addFavoriteVideo(user.userId, videoId, dto);
  }

  @Delete('videos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove video from favorites' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video removed from favorites' })
  @ApiResponse({ status: 404, description: 'Video not in favorites' })
  async removeFavoriteVideo(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
  ) {
    return this.favoritesService.removeFavoriteVideo(user.userId, videoId);
  }

  @Patch('videos/:id')
  @ApiOperation({ summary: 'Update favorite video notes' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Favorite video updated' })
  @ApiResponse({ status: 404, description: 'Video not in favorites' })
  async updateFavoriteVideo(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
    @Body() dto: UpdateFavoriteVideoDto,
  ) {
    return this.favoritesService.updateFavoriteVideo(user.userId, videoId, dto);
  }

  @Get('videos')
  @ApiOperation({ summary: 'Get user\'s favorite videos' })
  @ApiResponse({ status: 200, description: 'List of favorite videos' })
  async getFavoriteVideos(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetFavoriteVideosQueryDto,
  ) {
    return this.favoritesService.getFavoriteVideos(user.userId, query);
  }

  @Get('videos/:id/status')
  @ApiOperation({ summary: 'Check if video is favorited' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video favorite status' })
  async isVideoFavorited(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
  ) {
    const isFavorited = await this.favoritesService.isVideoFavorited(user.userId, videoId);
    return { isFavorited };
  }

  // ============ FAVORITE BANDS (FOLLOWING) ============

  @Post('bands/:id')
  @ApiOperation({ summary: 'Follow a band' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({ status: 201, description: 'Now following band' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  @ApiResponse({ status: 409, description: 'Already following band' })
  async followBand(
    @CurrentUser() user: CurrentUserData,
    @Param('id') bandId: string,
  ) {
    return this.favoritesService.followBand(user.userId, bandId);
  }

  @Delete('bands/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a band' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({ status: 200, description: 'Unfollowed band' })
  @ApiResponse({ status: 404, description: 'Not following band' })
  async unfollowBand(
    @CurrentUser() user: CurrentUserData,
    @Param('id') bandId: string,
  ) {
    return this.favoritesService.unfollowBand(user.userId, bandId);
  }

  @Patch('bands/:id')
  @ApiOperation({ summary: 'Update band follow settings' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({ status: 200, description: 'Band follow settings updated' })
  @ApiResponse({ status: 404, description: 'Not following band' })
  async updateFavoriteBand(
    @CurrentUser() user: CurrentUserData,
    @Param('id') bandId: string,
    @Body() dto: UpdateFavoriteBandDto,
  ) {
    return this.favoritesService.updateFavoriteBand(user.userId, bandId, dto);
  }

  @Get('bands')
  @ApiOperation({ summary: 'Get followed bands' })
  @ApiResponse({ status: 200, description: 'List of followed bands' })
  async getFollowedBands(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetFavoriteBandsQueryDto,
  ) {
    return this.favoritesService.getFollowedBands(user.userId, query);
  }

  @Get('bands/:id/status')
  @ApiOperation({ summary: 'Check if band is followed' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({ status: 200, description: 'Band follow status' })
  async isBandFollowed(
    @CurrentUser() user: CurrentUserData,
    @Param('id') bandId: string,
  ) {
    const isFollowed = await this.favoritesService.isBandFollowed(user.userId, bandId);
    const followerCount = await this.favoritesService.getBandFollowerCount(bandId);
    return { isFollowed, followerCount };
  }

  // ============ WATCH LATER ============

  @Post('watch-later/:id')
  @ApiOperation({ summary: 'Add video to watch later' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 201, description: 'Video added to watch later' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 409, description: 'Video already in watch later' })
  async addToWatchLater(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
  ) {
    return this.favoritesService.addToWatchLater(user.userId, videoId);
  }

  @Delete('watch-later/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove video from watch later' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video removed from watch later' })
  @ApiResponse({ status: 404, description: 'Video not in watch later' })
  async removeFromWatchLater(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
  ) {
    return this.favoritesService.removeFromWatchLater(user.userId, videoId);
  }

  @Patch('watch-later/:id')
  @ApiOperation({ summary: 'Mark video as watched/unwatched' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Watch later entry updated' })
  @ApiResponse({ status: 404, description: 'Video not in watch later' })
  async updateWatchLater(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
    @Body() dto: UpdateWatchLaterDto,
  ) {
    return this.favoritesService.updateWatchLater(user.userId, videoId, dto);
  }

  @Get('watch-later')
  @ApiOperation({ summary: 'Get watch later list' })
  @ApiResponse({ status: 200, description: 'Watch later list' })
  async getWatchLaterList(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetWatchLaterQueryDto,
  ) {
    return this.favoritesService.getWatchLaterList(user.userId, query);
  }

  @Get('watch-later/:id/status')
  @ApiOperation({ summary: 'Check if video is in watch later' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Watch later status' })
  async isInWatchLater(
    @CurrentUser() user: CurrentUserData,
    @Param('id') videoId: string,
  ) {
    const isInWatchLater = await this.favoritesService.isInWatchLater(user.userId, videoId);
    return { isInWatchLater };
  }

  // ============ COMBINED STATUS ============

  @Get('status/:videoId')
  @ApiOperation({ summary: 'Get video favorite and watch later status' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video status' })
  async getVideoStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('videoId') videoId: string,
  ) {
    return this.favoritesService.getVideoStatus(user.userId, videoId);
  }
}
