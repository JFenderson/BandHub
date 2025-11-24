import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SyncJobStatus } from '@prisma/client';
import {
  DashboardStatsDto,
  RecentActivityDto,
  RecentVideoDto,
  SyncJobDto,
  SyncStatusDto,
  VideoTrendDto,
  CategoryDistributionDto,
  TopBandDto,
} from './dto/dashboard.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    // Get total counts
    const [totalVideos, totalBands, pendingModeration] = await Promise.all([
      this.prisma.video.count(),
      this.prisma.band.count(),
      this.prisma.video.count({ where: { isHidden: true } }),
    ]);

    // Get videos added in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const videosThisWeek = await this.prisma.video.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get last sync job status
    const lastSyncJob = await this.prisma.syncJob.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return {
      totalVideos,
      totalBands,
      videosThisWeek,
      pendingModeration,
      lastSyncStatus: lastSyncJob?.status,
      lastSyncTime: lastSyncJob?.completedAt || lastSyncJob?.createdAt,
    };
  }

  /**
   * Get recent activity (videos and sync jobs)
   */
  async getRecentActivity(): Promise<RecentActivityDto> {
    // Get last 10 videos
    const videos = await this.prisma.video.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        createdAt: true,
        isHidden: true,
        band: {
          select: {
            name: true,
          },
        },
      },
    });

    const recentVideos: RecentVideoDto[] = videos.map((video) => ({
      id: video.id,
      title: video.title,
      bandName: video.band.name,
      thumbnailUrl: video.thumbnailUrl,
      createdAt: video.createdAt,
      isHidden: video.isHidden,
    }));

    // Get last 5 sync jobs
    const syncJobs = await this.prisma.syncJob.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Fetch band names for band-specific sync jobs
    const bandIds = syncJobs
      .filter((job) => job.bandId)
      .map((job) => job.bandId as string);
    
    const bands = await this.prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: { id: true, name: true },
    });

    const bandMap = new Map(bands.map((band) => [band.id, band.name]));

    const recentSyncJobs: SyncJobDto[] = syncJobs.map((job) => ({
      id: job.id,
      status: job.status,
      videosFound: job.videosFound,
      videosAdded: job.videosAdded,
      videosUpdated: job.videosUpdated,
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined,
      bandName: job.bandId ? bandMap.get(job.bandId) : undefined,
    }));

    return {
      recentVideos,
      recentSyncJobs,
    };
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatusDto> {
    // Find running sync job
    const runningJob = await this.prisma.syncJob.findFirst({
      where: {
        status: SyncJobStatus.IN_PROGRESS,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Get band name if band-specific sync
    let bandName: string | undefined;
    if (runningJob?.bandId) {
      const band = await this.prisma.band.findUnique({
        where: { id: runningJob.bandId },
        select: { name: true },
      });
      bandName = band?.name;
    }

    // Get failed jobs from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const failedJobs = await this.prisma.syncJob.findMany({
      where: {
        status: SyncJobStatus.FAILED,
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        videosFound: true,
        videosAdded: true,
        videosUpdated: true,
        createdAt: true,
        completedAt: true,
        bandId: true,
      },
    });

    // Fetch band names for failed jobs
    const bandIds = failedJobs
      .filter((job) => job.bandId)
      .map((job) => job.bandId as string);
    
    const bands = await this.prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: { id: true, name: true },
    });

    const bandMap = new Map(bands.map((band) => [band.id, band.name]));

    const failedJobsDto: SyncJobDto[] = failedJobs.map((job) => ({
      id: job.id,
      status: job.status,
      videosFound: job.videosFound,
      videosAdded: job.videosAdded,
      videosUpdated: job.videosUpdated,
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined,
      bandName: job.bandId ? bandMap.get(job.bandId) : undefined,
    }));

    return {
      isRunning: !!runningJob,
      currentJob: runningJob
        ? {
            id: runningJob.id,
            status: runningJob.status,
            videosFound: runningJob.videosFound,
            videosAdded: runningJob.videosAdded,
            videosUpdated: runningJob.videosUpdated,
            createdAt: runningJob.createdAt,
            completedAt: runningJob.completedAt || undefined,
            bandName,
          }
        : undefined,
      failedJobs: failedJobsDto,
    };
  }

  /**
   * Get video trends over the last 30 days
   */
  async getVideoTrends(): Promise<VideoTrendDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const videos = await this.prisma.video.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Group videos by date
    const videosByDate = new Map<string, number>();
    
    // Initialize all dates with 0
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime());
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      videosByDate.set(dateStr, 0);
    }

    // Count videos per date
    videos.forEach((video) => {
      const dateStr = video.createdAt.toISOString().split('T')[0];
      const count = videosByDate.get(dateStr) || 0;
      videosByDate.set(dateStr, count + 1);
    });

    // Convert to array and sort by date
    const trends: VideoTrendDto[] = Array.from(videosByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution(): Promise<CategoryDistributionDto[]> {
    const categories = await this.prisma.category.findMany({
      select: {
        name: true,
        slug: true,
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    return categories
      .map((category) => ({
        name: category.name,
        slug: category.slug,
        count: category._count.videos,
      }))
      .filter((category) => category.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get top 10 bands by video count
   */
  async getTopBands(): Promise<TopBandDto[]> {
    const bands = await this.prisma.band.findMany({
      select: {
        id: true,
        name: true,
        schoolName: true,
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    return bands
      .map((band) => ({
        id: band.id,
        name: band.name,
        schoolName: band.schoolName,
        videoCount: band._count.videos,
      }))
      .sort((a, b) => b.videoCount - a.videoCount)
      .slice(0, 10);
  }
}