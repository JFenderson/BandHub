import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import {
  DashboardStatsDto,
  RecentActivityDto,
  SyncStatusDto,
  VideoTrendDto,
  CategoryDistributionDto,
  TopBandDto,
} from './dto/dashboard.dto';

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
}