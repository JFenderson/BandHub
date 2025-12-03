import {
  Controller,
  Req,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { VideoQueryDto } from './dto/video-query.dto';

// Import AdminRole from generated Prisma client
import { AdminRole } from '@prisma/client';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  // ========================================
  // PUBLIC ROUTES (No authentication required)
  // ========================================

@Get()
@ApiOperation({ summary: 'Get all videos with filtering and pagination' })
@ApiResponse({ status: 200, description: 'Videos retrieved successfully' })
async findAll(@Req() req, @Query() query: VideoQueryDto) {
  const result = await this. videosService.findAll(query);
  return result;
}

  @Get(':id')
  @ApiOperation({ summary: 'Get a video by ID' })
  @ApiResponse({ status: 200, description: 'Video retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async findOne(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  // ========================================
  // MODERATOR ROUTES (Requires authentication + MODERATOR or SUPER_ADMIN role)
  // ========================================

  @Put(':id/hide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide a video from public view' })
  @ApiResponse({ status: 200, description: 'Video hidden successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async hideVideo(
    @Param('id') id: string,
    @Body('reason') reason: string = 'Hidden by moderator',
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.videosService.hideVideo(id, reason);
  }

  @Put(':id/unhide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unhide a video' })
  @ApiResponse({ status: 200, description: 'Video unhidden successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async unhideVideo(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.videosService.unhideVideo(id);
  }

  @Put(':id/category')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update video category' })
  @ApiResponse({ status: 200, description: 'Video category updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video or category not found' })
  async updateCategory(
    @Param('id') id: string,
    @Body('categoryId') categoryId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Use the update method to change category
    return this.videosService.update(id, { categoryId });
  }

  @Put(':id/quality')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update video quality metadata' })
  @ApiResponse({ status: 200, description: 'Video quality updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async updateQuality(
    @Param('id') id: string,
    @Body() qualityData: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Use update method with quality data
    return this.videosService.update(id, qualityData);
  }

  // ========================================
  // SUPER_ADMIN ONLY ROUTES
  // ========================================

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a video permanently (SUPER_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Video deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.videosService.delete(id);
  }
}
