import { ApiProperty } from '@nestjs/swagger';
import { SyncJobStatus } from '@prisma/client';

/**
 * Dashboard Statistics Response DTO
 */
export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of videos in the system' })
  totalVideos: number;

  @ApiProperty({ description: 'Total number of bands in the system' })
  totalBands: number;

  @ApiProperty({ description: 'Number of videos added in the last 7 days' })
  videosThisWeek: number;

  @ApiProperty({ description: 'Number of hidden videos pending moderation' })
  pendingModeration: number;

  @ApiProperty({ description: 'Status of the last sync job', required: false })
  lastSyncStatus?: SyncJobStatus;

  @ApiProperty({ description: 'Timestamp of the last sync job', required: false })
  lastSyncTime?: Date;
}

/**
 * Recent Video DTO for Activity Feed
 */
export class RecentVideoDto {
  @ApiProperty({ description: 'Video ID' })
  id: string;

  @ApiProperty({ description: 'Video title' })
  title: string;

  @ApiProperty({ description: 'Band name' })
  bandName: string;

  @ApiProperty({ description: 'Thumbnail URL' })
  thumbnailUrl: string;

  @ApiProperty({ description: 'Date video was added' })
  createdAt: Date;

  @ApiProperty({ description: 'Whether video is hidden' })
  isHidden: boolean;
}

/**
 * Sync Job DTO for Activity Feed
 */
export class SyncJobDto {
  @ApiProperty({ description: 'Sync job ID' })
  id: string;

  @ApiProperty({ description: 'Job status' })
  status: SyncJobStatus;

  @ApiProperty({ description: 'Number of videos found' })
  videosFound: number;

  @ApiProperty({ description: 'Number of videos added' })
  videosAdded: number;

  @ApiProperty({ description: 'Number of videos updated' })
  videosUpdated: number;

  @ApiProperty({ description: 'Job creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Job completion timestamp', required: false })
  completedAt?: Date;

  @ApiProperty({ description: 'Band name if band-specific sync', required: false })
  bandName?: string;
}

/**
 * Recent Activity Response DTO
 */
export class RecentActivityDto {
  @ApiProperty({ type: [RecentVideoDto], description: 'Last 10 videos added' })
  recentVideos: RecentVideoDto[];

  @ApiProperty({ type: [SyncJobDto], description: 'Last 5 sync jobs' })
  recentSyncJobs: SyncJobDto[];
}

/**
 * Current Sync Status DTO
 */
export class SyncStatusDto {
  @ApiProperty({ description: 'Whether a sync is currently running' })
  isRunning: boolean;

  @ApiProperty({ description: 'Current sync job if running', required: false })
  currentJob?: SyncJobDto;

  @ApiProperty({ description: 'Failed sync jobs from last 24 hours', type: [SyncJobDto] })
  failedJobs: SyncJobDto[];
}

/**
 * Video Trend Data Point DTO
 */
export class VideoTrendDto {
  @ApiProperty({ description: 'Date' })
  date: string;

  @ApiProperty({ description: 'Number of videos added on this date' })
  count: number;
}

/**
 * Category Distribution DTO
 */
export class CategoryDistributionDto {
  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Number of videos in category' })
  count: number;

  @ApiProperty({ description: 'Category slug' })
  slug: string;
}

/**
 * Top Band DTO
 */
export class TopBandDto {
  @ApiProperty({ description: 'Band ID' })
  id: string;

  @ApiProperty({ description: 'Band name' })
  name: string;

  @ApiProperty({ description: 'Number of videos' })
  videoCount: number;

  @ApiProperty({ description: 'School name' })
  schoolName: string;
}
