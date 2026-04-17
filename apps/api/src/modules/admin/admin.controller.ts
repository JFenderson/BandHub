import { Controller, Get, Post, Put, Patch, Body, Query, Param, UseGuards, HttpCode, HttpStatus, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
import { ApiErrorDto } from '../../common/dto/api-error.dto';

@ApiTags('Admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

@Get('dashboard/stats')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics', description: 'Retrieves high-level metrics for the admin dashboard.' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions', type: ApiErrorDto })
  async getDashboardStats() {
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

  @Post('videos/bulk-update')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk update videos', description: 'Applies changes to multiple videos simultaneously.' })
  @ApiResponse({ status: 200, description: 'Bulk update completed' })
  @ApiResponse({ status: 400, description: 'Invalid update payload', type: ApiErrorDto })
  async bulkUpdateVideos(
    @Body() dto: BulkVideoUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.bulkUpdateVideos(dto, user.userId);
  }

  @Post('videos/categorize')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger automatic video categorization',
    description:
      'Queues a background job that applies pattern-based category detection to videos. ' +
      'No YouTube API quota is consumed. ' +
      'By default only processes videos with no category assigned; pass uncategorizedOnly=false to re-run on all videos.',
  })
  @ApiResponse({ status: 202, description: 'Categorization job queued' })
  async triggerCategorization(
    @Body() body: { uncategorizedOnly?: boolean } = {},
  ): Promise<{ jobId: string; message: string }> {
    return this.adminService.triggerCategorization(body.uncategorizedOnly ?? true);
  }

  @Post('videos/rematch')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Re-match videos using the enhanced matching pipeline',
    description:
      'Resets band assignments for the specified set of videos and re-queues them for re-processing. ' +
      'MANUAL matches are never overwritten.',
  })
  @ApiResponse({ status: 202, description: 'Re-match job queued' })
  async triggerRematch(
    @Body()
    body: {
      filter?: 'all' | 'low_confidence' | 'unmatched' | 'alias_only';
      qualityScoreThreshold?: number;
      limit?: number;
    } = {},
  ): Promise<{ jobId: string; message: string }> {
    return this.adminService.triggerRematch(
      body.filter ?? 'unmatched',
      body.qualityScoreThreshold ?? 50,
      body.limit,
    );
  }

  @Post('videos/hide-excluded')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hide promoted videos flagged as non-HBCU content',
    description: 'Finds all promoted Video records whose source YouTubeVideo was AI-excluded (high school, drum corps, etc.) and sets isHidden=true. Reversible via the admin videos page.',
  })
  @ApiResponse({ status: 200, description: 'Excluded videos hidden' })
  async hideExcludedVideos(): Promise<{ hidden: number; message: string }> {
    return this.adminService.hideExcludedVideos();
  }

  @Post('videos/recategorize-other')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-run category detection on "Other" videos',
    description: 'Re-runs keyword-based category matching on all promoted videos currently in the "Other" catch-all or uncategorized. Does not use AI quota.',
  })
  @ApiResponse({ status: 200, description: 'Recategorization complete' })
  async recategorizeOtherVideos(): Promise<{ updated: number; message: string }> {
    return this.adminService.recategorizeOtherVideos();
  }

  @Post('videos/promote')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger video promotion job',
    description: 'Queues a PROMOTE_VIDEOS job that upserts all matched YouTubeVideos into the Video table.',
  })
  @ApiResponse({ status: 202, description: 'Promote job queued' })
  async triggerPromote(
    @Query('limit') limit?: string,
  ): Promise<{ jobId: string; message: string }> {
    return this.adminService.triggerPromote(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('videos/unmatched')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Paginated report of unmatched / AI-excluded YouTubeVideos',
    description: 'Returns YouTubeVideos with bandId=null or aiExcluded=true, grouped by noMatchReason with per-reason counts.',
  })
  @ApiResponse({ status: 200, description: 'Unmatched video report' })
  async getUnmatchedVideoReport(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUnmatchedVideoReport(page, Math.min(limit, 200));
  }

  @Post('videos/dev-reset')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV ONLY] Full re-match reset — clears Video + VideoBand, then re-queues matching',
    description:
      'Deletes all rows in the Video and VideoBand tables, resets isPromoted on all YouTubeVideos, ' +
      'and enqueues a full REMATCH_VIDEOS job. DESTRUCTIVE — dev/staging use only. Requires SUPER_ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Reset complete and re-match job enqueued' })
  async devResetAndRematch(): Promise<{
    deletedVideos: number;
    deletedVideoBands: number;
    resetYouTubeVideos: number;
    matchJobId: string;
    message: string;
  }> {
    return this.adminService.devResetAndRematch();
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