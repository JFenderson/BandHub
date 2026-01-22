import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, interval, from, switchMap, map, startWith, catchError, of } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { QUEUE_NAMES, JobPriority } from '@hbcu-band-hub/shared-types';
import {
  JobMetricsDto,
  JobTrendDto,
  StuckJobAlertDto,
  QueueControlDto,
  JobRetryDto,
} from '../dto/job-monitoring.dto';

interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@ApiTags('Admin - Job Monitoring')
@Controller({ path: 'admin/jobs', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class JobMonitoringController {
  constructor(
    @InjectQueue(QUEUE_NAMES.YOUTUBE_SYNC)
    private readonly syncQueue: Queue,

    @InjectQueue(QUEUE_NAMES.VIDEO_PROCESSING)
    private readonly processingQueue: Queue,

    @InjectQueue(QUEUE_NAMES.MAINTENANCE)
    private readonly maintenanceQueue: Queue,
  ) {}

  /**
   * Get real-time job statistics across all queues
   */
  @Get('metrics')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get real-time job statistics across all queues' })
  @ApiResponse({ status: 200, description: 'Job metrics retrieved successfully', type: JobMetricsDto })
  async getJobMetrics(): Promise<JobMetricsDto> {
    const queues = [
      { name: QUEUE_NAMES.YOUTUBE_SYNC, queue: this.syncQueue },
      { name: QUEUE_NAMES.VIDEO_PROCESSING, queue: this.processingQueue },
      { name: QUEUE_NAMES.MAINTENANCE, queue: this.maintenanceQueue },
    ];

    const queueMetrics = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

        return {
          queueName: name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
        };
      }),
    );

    // Calculate totals
    const totals = queueMetrics.reduce(
      (acc, curr) => ({
        waiting: acc.waiting + curr.waiting,
        active: acc.active + curr.active,
        completed: acc.completed + curr.completed,
        failed: acc.failed + curr.failed,
        delayed: acc.delayed + curr.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
    );

    // Calculate success rate (last 1000 jobs)
    const recentJobs = await Promise.all(
      queues.map(async ({ queue }) => {
        const [completed, failed] = await Promise.all([
          queue.getCompleted(0, 999),
          queue.getFailed(0, 999),
        ]);
        return { completed: completed.length, failed: failed.length };
      }),
    );

    const totalRecent = recentJobs.reduce(
      (acc, curr) => ({
        completed: acc.completed + curr.completed,
        failed: acc.failed + curr.failed,
      }),
      { completed: 0, failed: 0 },
    );

    const successRate =
      totalRecent.completed + totalRecent.failed > 0
        ? (totalRecent.completed / (totalRecent.completed + totalRecent.failed)) * 100
        : 100;

    // Get processing rate (jobs/minute)
    const processingRate = await this.calculateProcessingRate(queues);

    return {
      timestamp: new Date(),
      queues: queueMetrics,
      totals,
      successRate: Math.round(successRate * 100) / 100,
      processingRate: Math.round(processingRate * 100) / 100,
    };
  }

  /**
   * Server-Sent Events endpoint for real-time job updates
   */
  @Sse('live')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Subscribe to real-time job status updates via Server-Sent Events' })
  jobStatusUpdates(): Observable<MessageEvent> {
    return interval(2000).pipe(
      switchMap(() => from(this.getJobMetrics())),
      map((metrics) => ({
        data: metrics,
        id: Date.now().toString(),
        type: 'job-metrics',
      })),
      startWith({
        data: { message: 'Connected to job monitoring stream' },
        id: Date.now().toString(),
        type: 'connection',
      }),
      catchError((error) => {
        console.error('SSE Error:', error);
        return of({
          data: { error: 'Failed to fetch metrics' },
          id: Date.now().toString(),
          type: 'error',
        });
      }),
    );
  }

  /**
   * Get job success/failure trends over specified time periods
   */
  @Get('trends')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get job success/failure trends (24h, 7d, 30d)' })
  @ApiResponse({ status: 200, description: 'Trends calculated successfully', type: [JobTrendDto] })
  async getJobTrends(
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ): Promise<JobTrendDto[]> {
    const queues = [
      { name: QUEUE_NAMES.YOUTUBE_SYNC, queue: this.syncQueue },
      { name: QUEUE_NAMES.VIDEO_PROCESSING, queue: this.processingQueue },
      { name: QUEUE_NAMES.MAINTENANCE, queue: this.maintenanceQueue },
    ];

    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const cutoffTime = now - periodMs;

    const trends = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const [completedJobs, failedJobs] = await Promise.all([
          queue.getCompleted(0, 9999),
          queue.getFailed(0, 9999),
        ]);

        // Filter by time period
        const recentCompleted = completedJobs.filter(
          (job) => job.finishedOn && job.finishedOn >= cutoffTime,
        );
        const recentFailed = failedJobs.filter(
          (job) => job.finishedOn && job.finishedOn >= cutoffTime,
        );

        const total = recentCompleted.length + recentFailed.length;
        const successRate = total > 0 ? (recentCompleted.length / total) * 100 : 0;

        // Calculate average processing time
        const processingTimes = recentCompleted
          .filter((job) => job.processedOn && job.finishedOn)
          .map((job) => job.finishedOn! - job.processedOn!);

        const avgProcessingTime =
          processingTimes.length > 0
            ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
            : 0;

        return {
          queueName: name,
          period,
          successful: recentCompleted.length,
          failed: recentFailed.length,
          total,
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTime: Math.round(avgProcessingTime),
        };
      }),
    );

    return trends;
  }

  /**
   * Get alerts for jobs stuck in active state > 10 minutes
   */
  @Get('alerts/stuck')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get alerts for jobs stuck in active state > 10 minutes' })
  @ApiResponse({ status: 200, description: 'Stuck job alerts retrieved', type: [StuckJobAlertDto] })
  async getStuckJobAlerts(): Promise<StuckJobAlertDto[]> {
    const queues = [
      { name: QUEUE_NAMES.YOUTUBE_SYNC, queue: this.syncQueue },
      { name: QUEUE_NAMES.VIDEO_PROCESSING, queue: this.processingQueue },
      { name: QUEUE_NAMES.MAINTENANCE, queue: this.maintenanceQueue },
    ];

    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    const alerts: StuckJobAlertDto[] = [];

    for (const { name, queue } of queues) {
      const activeJobs = await queue.getActive(0, 999);

      for (const job of activeJobs) {
        if (job.processedOn && now - job.processedOn > TEN_MINUTES) {
          const stuckDuration = now - job.processedOn;
          const severity = this.calculateSeverity(stuckDuration);

          alerts.push({
            jobId: job.id!,
            queueName: name,
            jobName: job.name,
            stuckDuration,
            severity,
            startedAt: new Date(job.processedOn),
            data: job.data,
            attemptsMade: job.attemptsMade,
          });
        }
      }
    }

    // Sort by duration (longest stuck first)
    return alerts.sort((a, b) => b.stuckDuration - a.stuckDuration);
  }

  /**
   * Pause a specific queue
   */
  @Patch('queue/:queueName/pause')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Pause job processing for a specific queue' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  @HttpCode(HttpStatus.OK)
  async pauseQueue(@Param('queueName') queueName: string): Promise<QueueControlDto> {
    const queue = this.getQueue(queueName);
    await queue.pause();

    return {
      queueName,
      action: 'paused',
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * Resume a specific queue
   */
  @Patch('queue/:queueName/resume')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resume job processing for a specific queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  @HttpCode(HttpStatus.OK)
  async resumeQueue(@Param('queueName') queueName: string): Promise<QueueControlDto> {
    const queue = this.getQueue(queueName);
    await queue.resume();

    return {
      queueName,
      action: 'resumed',
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * Clear completed/failed jobs from a specific queue
   */
  @Delete('queue/:queueName/clear')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clear completed and failed jobs from a queue' })
  @ApiResponse({ status: 200, description: 'Queue cleared successfully' })
  @HttpCode(HttpStatus.OK)
  async clearQueue(
    @Param('queueName') queueName: string,
    @Query('type') type: 'completed' | 'failed' | 'all' = 'all',
  ): Promise<QueueControlDto> {
    const queue = this.getQueue(queueName);

    if (type === 'completed' || type === 'all') {
      await queue.clean(0, 0, 'completed');
    }

    if (type === 'failed' || type === 'all') {
      await queue.clean(0, 0, 'failed');
    }

    return {
      queueName,
      action: `cleared-${type}`,
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * Retry a failed job with modified parameters
   */
  @Post('retry/:queueName/:jobId')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retry a failed job with optional modified parameters' })
  @ApiResponse({ status: 200, description: 'Job retry queued successfully' })
  @HttpCode(HttpStatus.OK)
  async retryJobWithParams(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body() retryDto: JobRetryDto,
  ): Promise<{ success: boolean; newJobId: string; message: string }> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found in queue ${queueName}`);
    }

    // Merge original data with overrides
    const newJobData = {
      ...job.data,
      ...(retryDto.dataOverrides || {}),
    };

    // Create new job with modified parameters
    const newJob = await queue.add(
      job.name,
      newJobData,
      {
        priority: retryDto.priority || job.opts?.priority || JobPriority.NORMAL,
        attempts: retryDto.attempts || job.opts?.attempts || 3,
        backoff: retryDto.backoff || job.opts?.backoff,
      },
    );

    // Optionally remove the old failed job
    if (retryDto.removeOriginal !== false) {
      await job.remove();
    }

    return {
      success: true,
      newJobId: newJob.id!,
      message: `Job retried with ID ${newJob.id}`,
    };
  }

  /**
   * Get live updates for a specific queue via SSE
   */
  @Sse('queue/:queueName/live')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Subscribe to live updates for a specific queue' })
  queueLiveUpdates(@Param('queueName') queueName: string): Observable<MessageEvent> {
    const queue = this.getQueue(queueName);

    return interval(1000).pipe(
      switchMap(() => this.getQueueSnapshot(queue, queueName)),
      map((snapshot) => ({
        data: snapshot,
        id: Date.now().toString(),
        type: 'queue-update',
      })),
      catchError((error) => {
        console.error(`SSE Error for queue ${queueName}:`, error);
        return of({
          data: { error: 'Failed to fetch queue data' },
          id: Date.now().toString(),
          type: 'error',
        });
      }),
    );
  }

  // ============ HELPER METHODS ============

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case QUEUE_NAMES.YOUTUBE_SYNC:
        return this.syncQueue;
      case QUEUE_NAMES.VIDEO_PROCESSING:
        return this.processingQueue;
      case QUEUE_NAMES.MAINTENANCE:
        return this.maintenanceQueue;
      default:
        throw new BadRequestException(`Invalid queue name: ${queueName}`);
    }
  }

  private async getQueueSnapshot(queue: Queue, queueName: string): Promise<any> {
    const [waiting, active, completed, failed, delayed, isPaused, activeJobs] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
      queue.getActive(0, 9),
    ]);

    const activeJobDetails = activeJobs.map((job) => ({
      id: job.id,
      name: job.name,
      progress: job.progress,
      processedOn: job.processedOn,
      data: job.data,
    }));

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
      activeJobs: activeJobDetails,
      timestamp: new Date(),
    };
  }

  private async calculateProcessingRate(
    queues: Array<{ name: string; queue: Queue }>,
  ): Promise<number> {
    const ONE_MINUTE = 60 * 1000;
    const now = Date.now();
    const oneMinuteAgo = now - ONE_MINUTE;

    let recentCompletedCount = 0;

    for (const { queue } of queues) {
      const completed = await queue.getCompleted(0, 999);
      const recentCompleted = completed.filter(
        (job) => job.finishedOn && job.finishedOn >= oneMinuteAgo,
      );
      recentCompletedCount += recentCompleted.length;
    }

    return recentCompletedCount;
  }

  private getPeriodMs(period: '24h' | '7d' | '30d'): number {
    switch (period) {
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private calculateSeverity(stuckDuration: number): 'low' | 'medium' | 'high' | 'critical' {
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;
    const TWO_HOURS = 2 * 60 * 60 * 1000;

    if (stuckDuration >= TWO_HOURS) return 'critical';
    if (stuckDuration >= ONE_HOUR) return 'high';
    if (stuckDuration >= THIRTY_MINUTES) return 'medium';
    return 'low';
  }
}
