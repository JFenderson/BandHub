import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

// Import AdminRole from generated Prisma client
import { AdminRole } from '@hbcu-band-hub/prisma';
import { SyncJobFilterDto } from './dto/sync-job-filter.dto';
import { TriggerSyncDto } from './dto/trigger-sync.dto';
import { QueueActionDto, QueueAction } from './dto/queue-action.dto';
import { SyncJobListResponseDto, SyncJobDetailDto } from './dto/sync-job-detail.dto';
import { QueueStatusDto, ErrorStatsResponseDto } from './dto/queue-status.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // ========================================
  // MODERATOR ROUTES (Manual sync triggers from admin panel)
  // ========================================

  @Post('trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Manually trigger a full sync job' })
  @ApiResponse({ status: 202, description: 'Sync job queued successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async triggerSync(@CurrentUser() user: CurrentUserData) {
    // Use triggerBulkSync which is the actual method in SyncService
    return this.syncService.triggerBulkSync();
  }

  @Post('band/:bandId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Manually trigger sync for a specific band' })
  @ApiResponse({ status: 202, description: 'Band sync job queued successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async triggerBandSync(
    @Param('bandId') bandId: string,
    @Body('syncType') syncType: 'channel' | 'playlist' | 'search' = 'channel',
    @CurrentUser() user: CurrentUserData,
  ) {
    // triggerBandSync requires bandId and syncType
    return this.syncService.triggerBandSync(bandId, syncType);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current sync status and recent jobs' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getSyncStatus() {
    return this.syncService.getSyncStatus();
  }

  @Get('job/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get status of a specific sync job' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.syncService.getJobStatus(jobId);
  }

  // ========================================
  // WORKER/API KEY ROUTES (For scheduled background jobs)
  // ========================================

  @Post('worker/trigger')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger sync from worker (requires API key)' })
  @ApiResponse({ status: 202, description: 'Sync job queued successfully' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async workerTriggerSync() {
    // Worker triggers bulk sync
    return this.syncService.triggerBulkSync();
  }

  @Post('worker/band/:bandId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger band sync from worker (requires API key)' })
  @ApiResponse({ status: 202, description: 'Band sync job queued successfully' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async workerTriggerBandSync(
    @Param('bandId') bandId: string,
    @Body('syncType') syncType: 'channel' | 'playlist' | 'search' = 'channel',
  ) {
    return this.syncService.triggerBandSync(bandId, syncType);
  }
}

// ========================================
// ADMIN SYNC JOB MANAGEMENT ROUTES
// ========================================
@ApiTags('admin')
@Controller('admin/sync-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminSyncJobController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all sync jobs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Sync jobs retrieved', type: SyncJobListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getSyncJobs(@Query() filterDto: SyncJobFilterDto): Promise<SyncJobListResponseDto> {
    return this.syncService.getSyncJobs(filterDto);
  }

  @Get(':id')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get sync job details by ID' })
  @ApiResponse({ status: 200, description: 'Sync job details retrieved', type: SyncJobDetailDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Sync job not found' })
  async getSyncJobById(@Param('id') id: string): Promise<SyncJobDetailDto> {
    return this.syncService.getSyncJobById(id);
  }

  @Post(':id/retry')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry a failed sync job' })
  @ApiResponse({ status: 202, description: 'Job retry queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Sync job not found' })
  async retryJob(@Param('id') id: string) {
    return this.syncService.retryJob(id);
  }

  @Post('trigger')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Manually trigger a sync job' })
  @ApiResponse({ status: 202, description: 'Sync job queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async triggerManualSync(@Body() dto: TriggerSyncDto) {
    return this.syncService.triggerManualSync(dto);
  }
}

// ========================================
// ADMIN QUEUE MANAGEMENT ROUTES
// ========================================
@ApiTags('admin')
@Controller('admin/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminQueueController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get queue status and metrics' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved', type: [QueueStatusDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getQueueStatus(): Promise<QueueStatusDto[]> {
    return this.syncService.getQueueStatus();
  }

  @Post('pause')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the sync queue' })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async pauseQueue() {
    return this.syncService.pauseQueue();
  }

  @Post('resume')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume the sync queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async resumeQueue() {
    return this.syncService.resumeQueue();
  }

  @Post('clear-failed')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all failed jobs from database' })
  @ApiResponse({ status: 200, description: 'Failed jobs cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async clearFailedJobs() {
    return this.syncService.clearFailedJobs();
  }
}

// ========================================
// ADMIN ERROR TRACKING ROUTES
// ========================================
@ApiTags('admin')
@Controller('admin/sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminSyncErrorController {
  constructor(private readonly syncService: SyncService) {}

  @Get('errors')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get error statistics from sync jobs' })
  @ApiResponse({ status: 200, description: 'Error statistics retrieved', type: ErrorStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getErrorStats(): Promise<ErrorStatsResponseDto> {
    return this.syncService.getErrorStats();
  }
}