import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { SyncMode, JobPriority } from '@hbcu-band-hub/shared';

// DTOs with proper initialization
class SyncBandDto {
  bandId!: string;
  mode?: SyncMode;
  priority?: JobPriority;
}

class SyncAllBandsDto {
  mode?: SyncMode;
  batchSize?: number;
}

class CleanupDto {
  scope!: 'duplicates' | 'irrelevant' | 'deleted' | 'all';
  dryRun?: boolean;
}

@Controller('admin/queue')
export class QueueController {
  constructor(private queueService: QueueService) {}
  
  @Get('stats')
  async getStats() {
    return this.queueService.getAllQueues();
  }
  
  @Get(':queueName/jobs')
  async getJobs(
    @Param('queueName') queueName: string,
    @Query('status') status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'waiting',
    @Query('limit') limit: number = 20
  ) {
    return this.queueService.getJobs(queueName, status, limit);
  }
  
  @Get(':queueName/jobs/:jobId')
  async getJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    return this.queueService.getJob(queueName, jobId);
  }
  
  @Post('sync/band')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncBand(@Body() dto: SyncBandDto) {
    const job = await this.queueService.syncBand(
      dto.bandId,
      dto.mode || SyncMode.INCREMENTAL,
      dto.priority || JobPriority.HIGH
    );
    
    return {
      message: 'Sync job queued',
      jobId: job.id,
    };
  }
  
  @Post('sync/all')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncAllBands(@Body() dto: SyncAllBandsDto) {
    const job = await this.queueService.syncAllBands(
      dto.mode || SyncMode.INCREMENTAL,
      dto.batchSize || 5
    );
    
    return {
      message: 'Sync all bands job queued',
      jobId: job.id,
    };
  }
  
  @Post('cleanup')
  @HttpCode(HttpStatus.ACCEPTED)
  async cleanup(@Body() dto: CleanupDto) {
    const job = await this.queueService.cleanup(dto.scope, dto.dryRun);
    
    return {
      message: 'Cleanup job queued',
      jobId: job.id,
    };
  }
  
  @Post(':queueName/jobs/:jobId/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    await this.queueService.retryJob(queueName, jobId);
  }
  
  @Delete(':queueName/jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    await this.queueService.removeJob(queueName, jobId);
  }
  
  @Post(':queueName/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pauseQueue(@Param('queueName') queueName: string) {
    await this.queueService.pauseQueue(queueName);
  }
  
  @Post(':queueName/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resumeQueue(@Param('queueName') queueName: string) {
    await this.queueService.resumeQueue(queueName);
  }
  
  @Post(':queueName/drain')
  @HttpCode(HttpStatus.NO_CONTENT)
  async drainQueue(@Param('queueName') queueName: string) {
    await this.queueService.drainQueue(queueName);
  }
}