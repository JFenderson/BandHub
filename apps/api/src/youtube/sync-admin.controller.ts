import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { YoutubeSyncService, SyncOptions } from './youtube-sync.service';
import { YoutubeSyncScheduler } from './youtube-sync.scheduler';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

/**
 * Admin endpoints for YouTube sync management
 */
@ApiTags('Admin Sync')
@Controller({ path: 'admin/sync', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SyncAdminController {
  constructor(
    private readonly youtubeSyncService: YoutubeSyncService,
    private readonly youtubeSyncScheduler: YoutubeSyncScheduler,
  ) {}

  /**
   * Trigger full historical sync for a specific band
   */
  @Post('bands/:id/full')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger full historical sync for a band' })
  @ApiResponse({ status: 202, description: 'Full sync started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async triggerFullSync(@Param('id') bandId: string) {
    const result = await this.youtubeSyncService.fullBackfill(bandId);
    return {
      message: 'Full sync completed',
      result: {
        bandId: result.bandId,
        bandName: result.bandName,
        syncJobId: result.syncJobId,
        videosAdded: result.videosAdded,
        videosUpdated: result.videosUpdated,
        quotaUsed: result.quotaUsed,
        duration: result.duration,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
  }

  /**
   * Trigger incremental sync for a specific band
   */
  @Post('bands/:id/incremental')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger incremental sync for a band' })
  @ApiResponse({ status: 202, description: 'Incremental sync started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async triggerIncrementalSync(@Param('id') bandId: string) {
    const result = await this.youtubeSyncService.syncBand(bandId);
    return {
      message: 'Incremental sync completed',
      result: {
        bandId: result.bandId,
        bandName: result.bandName,
        syncJobId: result.syncJobId,
        videosAdded: result.videosAdded,
        videosUpdated: result.videosUpdated,
        quotaUsed: result.quotaUsed,
        duration: result.duration,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
  }

  /**
   * Get sync status for a specific band
   */
  @Get('bands/:id/status')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get sync status and coverage for a band' })
  @ApiResponse({ status: 200, description: 'Band sync status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async getBandSyncStatus(@Param('id') bandId: string) {
return this.youtubeSyncService.getSyncStats();
  }

  /**
   * Get overall sync statistics
   */
  @Get('stats')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get overall sync statistics' })
  @ApiResponse({ status: 200, description: 'Sync statistics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getSyncStats() {
    return this.youtubeSyncService.getSyncStats();
  }

  /**
   * Get list of bands needing full sync
   */
  @Get('bands/needing-sync')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get bands that need full historical sync' })
  @ApiResponse({ status: 200, description: 'Bands needing sync retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getBandsNeedingSync() {
    const bands = await this.youtubeSyncService.getBandsNeedingFullSync();
    return {
      count: bands.length,
      bands,
    };
  }

  /**
   * Get scheduler status
   */
  @Get('scheduler/status')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get scheduler status and schedules' })
  @ApiResponse({ status: 200, description: 'Scheduler status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getSchedulerStatus() {
    return this.youtubeSyncScheduler.getSchedulerStatus();
  }

  /**
   * Documentation endpoint for backfill process
   */
  @Get('backfill-all')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get information about running full backfill' })
  @ApiResponse({ status: 200, description: 'Backfill information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getBackfillInfo() {
    const bandsNeedingSync = await this.youtubeSyncService.getBandsNeedingFullSync();
    const stats = await this.youtubeSyncService.getSyncStats();

    return {
      message: 'To run a full backfill, use the CLI script',
      command: 'npm run backfill',
      notes: [
        'Full backfill syncs ALL historical videos (from 2005)',
        'This process respects YouTube API quota limits',
        'It will take 7-10 days to complete all bands',
        'The script can be safely stopped and resumed',
      ],
      currentStatus: {
        bandsNeedingFullSync: bandsNeedingSync.length,
        totalBands: stats.totalBands,
        totalVideos: stats.totalVideos,
        dailyQuotaRemaining: stats.dailyQuotaRemaining,
      },
    };
  }

  /**
   * Sync a band with custom options
   */
  @Post('bands/:id/custom')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger sync with custom options' })
  @ApiResponse({ status: 202, description: 'Custom sync started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async triggerCustomSync(
    @Param('id') bandId: string,
    @Body() options: {
      publishedAfter?: string;
      publishedBefore?: string;
      maxVideos?: number;
      forceFullSync?: boolean;
    },
  ) {
    const syncOptions: SyncOptions = {
      publishedAfter: options.publishedAfter ? new Date(options.publishedAfter) : undefined,
      publishedBefore: options.publishedBefore ? new Date(options.publishedBefore) : undefined,
      maxVideos: options.maxVideos,
      forceFullSync: options.forceFullSync,
    };

    const result = await this.youtubeSyncService.syncBand(bandId, syncOptions);
    return {
      message: 'Custom sync completed',
      result: {
        bandId: result.bandId,
        bandName: result.bandName,
        syncJobId: result.syncJobId,
        videosAdded: result.videosAdded,
        videosUpdated: result.videosUpdated,
        quotaUsed: result.quotaUsed,
        duration: result.duration,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
  }
}
