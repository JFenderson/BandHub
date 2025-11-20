import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('band/:id')
  @ApiOperation({ summary: 'Trigger sync for a specific band' })
  @ApiResponse({ status: 201, description: 'Sync job queued' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force full sync' })
  async syncBand(
    @Param('id') bandId: string,
    @Query('force') force: boolean = false,
  ) {
    // Simplified - let the processor determine the sync type based on band data
    return this.syncService.triggerBandSync(bandId, 'channel', force);
  }

  @Post('all')
  @ApiOperation({ summary: 'Trigger sync for all active bands' })
  @ApiResponse({ status: 201, description: 'Bulk sync job queued' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  async syncAll(@Query('force') force: boolean = false) {
    return this.syncService.triggerBulkSync(force);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync queue status' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved' })
  async getStatus() {
    return this.syncService.getSyncStatus();
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: 'Get job status (limited info available)' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.syncService.getJobStatus(jobId);
  }
}