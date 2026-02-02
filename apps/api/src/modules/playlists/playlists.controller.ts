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
import { AddCollaboratorDto } from './dto/collaborator.dto';
import { CreateShareLinkDto } from './dto/share.dto';
import { ReorderVideosDto } from './dto/reorder-videos.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

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
    @Body() dto: ReorderVideosDto,
  ) {
    return this.playlistsService.reorderVideos(id, user.userId, dto.videoIds);
  }

  // Collaboration endpoints
  @Post(':id/collaborators')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add collaborator to playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 201, description: 'Collaborator added' })
  @ApiResponse({ status: 404, description: 'Playlist or user not found' })
  @ApiResponse({ status: 403, description: 'Only owner can add collaborators' })
  @ApiResponse({ status: 409, description: 'User is already a collaborator' })
  async addCollaborator(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.playlistsService.addCollaborator(id, user.userId, dto);
  }

  @Delete(':id/collaborators/:userId')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove collaborator from playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 200, description: 'Collaborator removed' })
  @ApiResponse({ status: 404, description: 'Playlist or collaborator not found' })
  @ApiResponse({ status: 403, description: 'Only owner can remove collaborators' })
  async removeCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.playlistsService.removeCollaborator(id, user.userId, userId);
  }

  @Get(':id/collaborators')
  @ApiOperation({ summary: 'Get playlist collaborators' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'List of collaborators' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Cannot view collaborators of private playlist' })
  async getCollaborators(@Param('id') id: string, @CurrentUser() user?: CurrentUserData) {
    return this.playlistsService.getCollaborators(id, user?.userId);
  }

  // Sharing endpoints
  @Post(':id/share')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate share link for playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 201, description: 'Share link created' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'No permission to share playlist' })
  async generateShareLink(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto?: CreateShareLinkDto,
  ) {
    return this.playlistsService.generateShareLink(id, user.userId, dto);
  }

  @Delete(':id/share')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke share link' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Share link revoked' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'No permission to revoke share link' })
  async revokeShareLink(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.playlistsService.revokeShareLink(id, user.userId);
  }

  // Following endpoints
  @Post(':id/follow')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a public playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 201, description: 'Playlist followed' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Cannot follow private playlists' })
  @ApiResponse({ status: 409, description: 'Already following this playlist' })
  async followPlaylist(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.playlistsService.followPlaylist(id, user.userId);
  }

  @Delete(':id/follow')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist unfollowed' })
  @ApiResponse({ status: 404, description: 'Not following this playlist' })
  async unfollowPlaylist(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.playlistsService.unfollowPlaylist(id, user.userId);
  }

  @Get(':id/followers')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get playlist followers' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'List of followers' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Only owner can view followers' })
  async getFollowers(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.playlistsService.getFollowers(id, user.userId);
  }

  // Featured playlists endpoints
  @Get('featured')
  @ApiOperation({ summary: 'Get featured playlists' })
  @ApiResponse({ status: 200, description: 'List of featured playlists' })
  async getFeaturedPlaylists(@Query() query: GetPlaylistsQueryDto) {
    return this.playlistsService.getFeaturedPlaylists(query);
  }

  @Patch(':id/featured')
  @UseGuards(UserAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark playlist as featured (Admin only)' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist marked as featured' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 409, description: 'Playlist is already featured' })
  async markAsFeatured(@Param('id') id: string) {
    return this.playlistsService.markAsFeatured(id);
  }

  @Delete(':id/featured')
  @UseGuards(UserAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unmark playlist as featured (Admin only)' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiResponse({ status: 200, description: 'Playlist unmarked as featured' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async unmarkAsFeatured(@Param('id') id: string) {
    return this.playlistsService.unmarkAsFeatured(id);
  }
}

// Share controller for public access without auth
@ApiTags('share')
@Controller({ path: 'share', version: '1' })
export class ShareController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Access shared playlist via token' })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiResponse({ status: 200, description: 'Shared playlist details' })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  @ApiResponse({ status: 403, description: 'Share link expired or revoked' })
  async getSharedPlaylist(@Param('token') token: string) {
    return this.playlistsService.getPlaylistByShareToken(token);
  }
}
