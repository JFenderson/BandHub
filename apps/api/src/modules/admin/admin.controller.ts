import { Controller, Get, Post, Put, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { AdminRole } from '@prisma/client';
import {
  DashboardStatsDto,
  RecentActivityDto,
  SyncStatusDto,
  VideoTrendDto,
  CategoryDistributionDto,
  TopBandDto,
} from './dto/dashboard.dto';
import { AdminVideoQueryDto } from './dto/admin-video-query.dto';
import { BulkVideoUpdateDto, BulkVideoUpdateResponseDto } from './dto/bulk-video-update.dto';
import { VideoDetailDto } from './dto/video-detail.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved', type: DashboardStatsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/recent-activity')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get recent activity (videos and sync jobs)' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved', type: RecentActivityDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getRecentActivity(): Promise<RecentActivityDto> {
    return this.adminService.getRecentActivity();
  }

  @Get('dashboard/sync-status')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get current sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved', type: SyncStatusDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getSyncStatus(): Promise<SyncStatusDto> {
    return this.adminService.getSyncStatus();
  }

  @Get('dashboard/video-trends')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get video trends over last 30 days' })
  @ApiResponse({ status: 200, description: 'Video trends retrieved', type: [VideoTrendDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getVideoTrends(): Promise<VideoTrendDto[]> {
    return this.adminService.getVideoTrends();
  }

  @Get('dashboard/category-distribution')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get video distribution by category' })
  @ApiResponse({ status: 200, description: 'Category distribution retrieved', type: [CategoryDistributionDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getCategoryDistribution(): Promise<CategoryDistributionDto[]> {
    return this.adminService.getCategoryDistribution();
  }

  @Get('dashboard/top-bands')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get top 10 bands by video count' })
  @ApiResponse({ status: 200, description: 'Top bands retrieved', type: [TopBandDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getTopBands(): Promise<TopBandDto[]> {
    return this.adminService.getTopBands();
  }

  // ============ VIDEO MODERATION ENDPOINTS ============

  @Get('videos')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get videos for admin moderation with advanced filtering' })
  @ApiResponse({ status: 200, description: 'Videos retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAdminVideos(@Query() query: AdminVideoQueryDto): Promise<{
    data: VideoDetailDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.adminService.getAdminVideos(query);
  }

  @Patch('videos/bulk')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk update videos' })
  @ApiResponse({ status: 200, description: 'Bulk update completed', type: BulkVideoUpdateResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async bulkUpdateVideos(
    @Body() dto: BulkVideoUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BulkVideoUpdateResponseDto> {
    return this.adminService.bulkUpdateVideos(dto, user.userId);
  }

  @Put('videos/:id')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a single video' })
  @ApiResponse({ status: 200, description: 'Video updated successfully', type: VideoDetailDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async updateVideo(
    @Param('id') id: string,
    @Body() updateData: {
      categoryId?: string;
      opponentBandId?: string;
      eventName?: string;
      eventYear?: number;
      tags?: string[];
      qualityScore?: number;
      isHidden?: boolean;
      hideReason?: string;
    },
    @CurrentUser() user: CurrentUserData,
  ): Promise<VideoDetailDto> {
    return this.adminService.updateVideo(id, updateData, user.userId);
  }
}