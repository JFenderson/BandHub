import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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