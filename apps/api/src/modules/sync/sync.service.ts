import { Injectable, NotFoundException } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { DatabaseService } from '../../database/database.service';
import { QUEUE_NAMES, SyncMode } from '@hbcu-band-hub/shared-types';
import { SyncJobFilterDto } from './dto/sync-job-filter.dto';
import { SyncJobDetailDto, SyncJobListResponseDto } from './dto/sync-job-detail.dto';
import { QueueStatusDto, ErrorStatsResponseDto, ErrorStatDto } from './dto/queue-status.dto';
import { TriggerSyncDto, TriggerSyncType } from './dto/trigger-sync.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SyncService {
  constructor(
    private readonly queueService: QueueService,
    private readonly database: DatabaseService,
  ) {}

  async triggerBandSync(bandId: string, syncType: 'channel' | 'playlist' | 'search', forceSync = false) {
    // Map our sync types to your existing job data format
    const jobSyncType = forceSync ? 'full' : 'incremental';
    
    // Use your existing addSyncBandJob method
    const job = await this.queueService.addSyncBandJob({
      bandId,
      syncType: jobSyncType,
    });

    return {
      jobId: job.id,
      message: `Sync job queued for band ${bandId}`,
    };
  }

  async triggerBulkSync(forceSync = false) {
    // Use your existing addSyncAllBandsJob method
    const job = await this.queueService.addSyncAllBandsJob();

    return {
      jobId: job.id,
      message: `Bulk sync job queued for all bands`,
    };
  }

  async getSyncStatus() {
    // Use your existing getQueueStats method
    return await this.queueService.getAllQueues();
  }

  async getJobStatus(jobId: string) {
    // Since we can't get individual jobs with your current service,
    // let's return the queue stats for now
    const stats = await this.queueService.getAllQueues();
    
    return {
      jobId,
      queueStats: stats,
      message: 'Use queue stats to monitor job progress',
    };
  }

  // New comprehensive methods for admin interface

  async getSyncJobs(filterDto: SyncJobFilterDto): Promise<SyncJobListResponseDto> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = filterDto;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.SyncJobWhereInput = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.jobType) {
      where.jobType = filters.jobType;
    }
    
    if (filters.bandId) {
      where.bandId = filters.bandId;
    }
    
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Get total count
    const total = await this.database.syncJob.count({ where });

    // Get paginated results
    const syncJobs = await this.database.syncJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        band: {
          select: {
            name: true,
          },
        },
      },
    });

    // Map to DTOs
    const data: SyncJobDetailDto[] = syncJobs.map((job) => {
      const dto: SyncJobDetailDto = {
        id: job.id,
        bandId: job.bandId || undefined,
        bandName: job.band?.name,
        jobType: job.jobType,
        status: job.status,
        videosFound: job.videosFound,
        videosAdded: job.videosAdded,
        videosUpdated: job.videosUpdated,
        errors: job.errors,
        startedAt: job.startedAt || undefined,
        completedAt: job.completedAt || undefined,
        createdAt: job.createdAt,
      };

      // Calculate duration if completed
      if (job.startedAt && job.completedAt) {
        dto.duration = job.completedAt.getTime() - job.startedAt.getTime();
      }

      return dto;
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSyncJobById(id: string): Promise<SyncJobDetailDto> {
    const syncJob = await this.database.syncJob.findUnique({
      where: { id },
      include: {
        band: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!syncJob) {
      throw new NotFoundException(`Sync job with ID ${id} not found`);
    }

    const dto: SyncJobDetailDto = {
      id: syncJob.id,
      bandId: syncJob.bandId || undefined,
      bandName: syncJob.band?.name,
      jobType: syncJob.jobType,
      status: syncJob.status,
      videosFound: syncJob.videosFound,
      videosAdded: syncJob.videosAdded,
      videosUpdated: syncJob.videosUpdated,
      errors: syncJob.errors,
      startedAt: syncJob.startedAt || undefined,
      completedAt: syncJob.completedAt || undefined,
      createdAt: syncJob.createdAt,
    };

    // Calculate duration if completed
    if (syncJob.startedAt && syncJob.completedAt) {
      dto.duration = syncJob.completedAt.getTime() - syncJob.startedAt.getTime();
    }

    return dto;
  }

  async retryJob(id: string): Promise<{ message: string; jobId: string }> {
    const syncJob = await this.database.syncJob.findUnique({
      where: { id },
    });

    if (!syncJob) {
      throw new NotFoundException(`Sync job with ID ${id} not found`);
    }

    if (!syncJob.bandId) {
      // Retry all bands sync
      const job = await this.queueService.addSyncAllBandsJob();
      return {
        message: 'Full sync job queued',
        jobId: job.id?.toString() || '',
      };
    }

    // Retry single band sync
    const job = await this.queueService.addSyncBandJob({
      bandId: syncJob.bandId,
      syncType: syncJob.jobType === 'FULL_SYNC' ? 'full' : 'incremental',
    });

    return {
      message: `Sync job queued for band ${syncJob.bandId}`,
      jobId: job.id?.toString() || '',
    };
  }

  async triggerManualSync(dto: TriggerSyncDto): Promise<{ message: string; jobId: string }> {
    const syncMode = dto.syncType === TriggerSyncType.FULL ? SyncMode.FULL : SyncMode.INCREMENTAL;

    if (dto.bandId) {
      // Single band sync
      const job = await this.queueService.syncBand(dto.bandId, syncMode);
      return {
        message: `Sync job queued for band ${dto.bandId}`,
        jobId: job.id?.toString() || '',
      };
    } else {
      // All bands sync
      const job = await this.queueService.syncAllBands(syncMode);
      return {
        message: 'Bulk sync job queued for all bands',
        jobId: job.id?.toString() || '',
      };
    }
  }

  async getQueueStatus(): Promise<QueueStatusDto[]> {
    const stats = await this.queueService.getAllQueues();
    return stats.map(stat => ({
      name: stat.name,
      waiting: stat.waiting,
      active: stat.active,
      completed: stat.completed,
      failed: stat.failed,
      delayed: stat.delayed,
      paused: false, // BullMQ doesn't expose paused state easily
    }));
  }

  async pauseQueue(): Promise<{ message: string }> {
    await this.queueService.pauseQueue(QUEUE_NAMES.YOUTUBE_SYNC);
    return { message: 'Queue paused successfully' };
  }

  async resumeQueue(): Promise<{ message: string }> {
    await this.queueService.resumeQueue(QUEUE_NAMES.YOUTUBE_SYNC);
    return { message: 'Queue resumed successfully' };
  }

  async clearFailedJobs(): Promise<{ message: string; count: number }> {
    // Get failed jobs from database
    const failedJobs = await this.database.syncJob.findMany({
      where: { status: 'FAILED' },
    });

    // Delete them
    await this.database.syncJob.deleteMany({
      where: { status: 'FAILED' },
    });

    return {
      message: `Cleared ${failedJobs.length} failed jobs`,
      count: failedJobs.length,
    };
  }

  async getErrorStats(): Promise<ErrorStatsResponseDto> {
    // Get all jobs with errors
    const jobsWithErrors = await this.database.syncJob.findMany({
      where: {
        errors: {
          isEmpty: false,
        },
      },
      include: {
        band: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group errors by message
    const errorMap = new Map<string, ErrorStatDto>();

    for (const job of jobsWithErrors) {
      for (const error of job.errors) {
        if (!errorMap.has(error)) {
          errorMap.set(error, {
            errorMessage: error,
            count: 0,
            affectedBands: [],
            lastOccurred: job.createdAt,
          });
        }

        const stat = errorMap.get(error)!;
        stat.count++;
        
        if (job.band && !stat.affectedBands.includes(job.band.name)) {
          stat.affectedBands.push(job.band.name);
        }

        if (job.createdAt > stat.lastOccurred) {
          stat.lastOccurred = job.createdAt;
        }
      }
    }

    const errors = Array.from(errorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 errors

    return {
      errors,
      totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
    };
  }
}