import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { GetPlaylistsQueryDto, AddVideoToPlaylistDto } from './dto/playlist-query.dto';

@ApiTags('playlists')
@Controller({ path: 'playlists', version: '1' })
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new playlist' })
  @ApiResponse({ status: 201, description: 'Playlist created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser() user: CurrentUserData, @Body() createDto: CreatePlaylistDto) {
    return this.playlistsService.create(user.userId, createDto);
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s playlists' })
  @ApiResponse({ status: 200, description: 'List of user playlists' })
  async getUserPlaylists(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetPlaylistsQueryDto,
  ) {
    return this.playlistsService.findUserPlaylists(user.userId, query);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover public playlists' })
  @ApiResponse({ status: 200, description: 'List of public playlists' })
  async discoverPlaylists(@Query() query: GetPlaylistsQueryDto) {
    return this.playlistsService.findPublicPlaylists(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist details' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Playlist is private' })
  async getPlaylist(@Param('id') id: string, @CurrentUser() user?: CurrentUserData) {
    return this.playlistsService.findOne(id, user?.userId);
  }

  @Put(':id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist updated' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() updateDto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(id, user.userId, updateDto);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist deleted' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.playlistsService.remove(id, user.userId);
  }

  @Post(':id/videos/:videoId')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add video to playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 201, description: 'Video added to playlist' })
  @ApiResponse({ status: 404, description: 'Playlist or video not found' })
  @ApiResponse({ status: 409, description: 'Video already in playlist' })
  async addVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AddVideoToPlaylistDto,
  ) {
    return this.playlistsService.addVideo(id, videoId, user.userId, dto);
  }

  @Delete(':id/videos/:videoId')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove video from playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video removed from playlist' })
  @ApiResponse({ status: 404, description: 'Playlist or video not found' })
  async removeVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.playlistsService.removeVideo(id, videoId, user.userId);
  }

  @Patch(':id/reorder')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder videos in playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist order updated' })
  async reorderVideos(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body('videoIds') videoIds: string[],
  ) {
    return this.playlistsService.reorderVideos(id, user.userId, videoIds);
  }
}
