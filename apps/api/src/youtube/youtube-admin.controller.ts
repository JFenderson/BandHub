import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole, SyncStatus } from '@prisma/client';
import { YouTubeVideoRepository, YouTubeVideoQueryDto as RepoQueryDto } from './youtube-video.repository';
import { YoutubeService } from './youtube.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import {
  YouTubeVideoQueryDto,
  YouTubeVideoListResponseDto,
  TriggerSyncDto,
  SyncStatusResponseDto,
} from './dto';

@ApiTags('Admin YouTube')
@Controller('admin/youtube')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class YouTubeAdminController {
  private dailyQuotaUsed = 0;
  private quotaResetTime: Date = new Date();

  constructor(
    private readonly youtubeVideoRepository: YouTubeVideoRepository,
    private readonly youtubeService: YoutubeService,
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.resetDailyQuotaIfNeeded();
  }

  // ==================== SYNC ENDPOINTS ====================

  /**
   * Trigger sync for a specific band
   */
  @Post('sync/bands/:bandId')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger YouTube video sync for a specific band' })
  @ApiParam({ name: 'bandId', description: 'Band ID' })
  @ApiResponse({ status: 202, description: 'Sync started' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async syncBand(
    @Param('bandId') bandId: string,
    @Body() dto: TriggerSyncDto,
  ) {
    const band = await this.db.band.findUnique({
      where: { id: bandId },
      select: { id: true, name: true, youtubeChannelId: true, lastSyncAt: true },
    });

    if (!band) {
      throw new NotFoundException(`Band with ID ${bandId} not found`);
    }

    if (!band.youtubeChannelId) {
      return {
        success: false,
        message: `Band ${band.name} does not have a YouTube channel ID configured`,
      };
    }

    // Determine sync parameters
    const publishedAfter = dto.publishedAfter
      ? new Date(dto.publishedAfter)
      : dto.fullSync
      ? new Date('2005-04-23') // YouTube launch date
      : band.lastSyncAt || new Date('2005-04-23');

    // Fetch videos from YouTube
    const result = await this.youtubeService.fetchAllChannelVideos(band.youtubeChannelId, {
      publishedAfter,
      maxVideos: dto.maxVideos,
    });

    this.dailyQuotaUsed += result.quotaUsed;

    // Store videos in database
    let added = 0;
    let updated = 0;

    for (const video of result.videos) {
      const upsertResult = await this.youtubeVideoRepository.upsert({
        youtubeId: video.youtubeId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        url: video.url,
        duration: video.duration,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        bandId: band.id,
      });

      // Check if it was a create or update based on createdAt vs updatedAt
      const isNew = upsertResult.createdAt.getTime() === upsertResult.updatedAt.getTime() ||
                   Math.abs(upsertResult.createdAt.getTime() - upsertResult.updatedAt.getTime()) < 1000;
      if (isNew) added++;
      else updated++;
    }

    // Update band sync tracking
    await this.db.band.update({
      where: { id: band.id },
      data: {
        lastSyncAt: new Date(),
        syncStatus: SyncStatus.COMPLETED,
        ...(dto.fullSync && { lastFullSync: new Date() }),
      },
    });

    return {
      success: true,
      bandId: band.id,
      bandName: band.name,
      videosAdded: added,
      videosUpdated: updated,
      totalVideosFetched: result.videos.length,
      quotaUsed: result.quotaUsed,
      errors: result.errors,
    };
  }

  /**
   * Trigger sync for a specific content creator
   */
  @Post('sync/creators/:creatorId')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger YouTube video sync for a specific content creator' })
  @ApiParam({ name: 'creatorId', description: 'Creator ID' })
  @ApiResponse({ status: 202, description: 'Sync started' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  async syncCreator(
    @Param('creatorId') creatorId: string,
    @Body() dto: TriggerSyncDto,
  ) {
    const creator = await this.db.contentCreator.findUnique({
      where: { id: creatorId },
      select: { id: true, name: true, youtubeChannelId: true, lastSyncedAt: true },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with ID ${creatorId} not found`);
    }

    // Determine sync parameters
    const publishedAfter = dto.publishedAfter
      ? new Date(dto.publishedAfter)
      : dto.fullSync
      ? new Date('2005-04-23')
      : creator.lastSyncedAt || new Date('2005-04-23');

    // Fetch videos from YouTube
    const result = await this.youtubeService.fetchAllChannelVideos(creator.youtubeChannelId, {
      publishedAfter,
      maxVideos: dto.maxVideos,
    });

    this.dailyQuotaUsed += result.quotaUsed;

    // Store videos in database
    let added = 0;
    let updated = 0;

    for (const video of result.videos) {
      const upsertResult = await this.youtubeVideoRepository.upsert({
        youtubeId: video.youtubeId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        url: video.url,
        duration: video.duration,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        creatorId: creator.id,
      });

      const isNew = upsertResult.createdAt.getTime() === upsertResult.updatedAt.getTime() ||
                   Math.abs(upsertResult.createdAt.getTime() - upsertResult.updatedAt.getTime()) < 1000;
      if (isNew) added++;
      else updated++;
    }

    // Update creator sync tracking
    await this.db.contentCreator.update({
      where: { id: creator.id },
      data: {
        lastSyncedAt: new Date(),
        ...(dto.fullSync && { lastFullSync: new Date() }),
        videosInOurDb: await this.db.youTubeVideo.count({
          where: { creatorId: creator.id },
        }),
      },
    });

    return {
      success: true,
      creatorId: creator.id,
      creatorName: creator.name,
      videosAdded: added,
      videosUpdated: updated,
      totalVideosFetched: result.videos.length,
      quotaUsed: result.quotaUsed,
      errors: result.errors,
    };
  }

  /**
   * Trigger sync for all bands with YouTube channels
   */
  @Post('sync/all-bands')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger YouTube video sync for all bands (use with caution)' })
  @ApiResponse({ status: 202, description: 'Bulk sync started' })
  async syncAllBands(@Body() dto: TriggerSyncDto) {
    const bands = await this.db.band.findMany({
      where: {
        youtubeChannelId: { not: null },
        isActive: true,
      },
      select: { id: true, name: true },
    });

    return {
      message: `Bulk sync initiated for ${bands.length} bands`,
      note: 'For full historical backfill, use the CLI script: npx tsx apps/api/scripts/backfill-band-videos.ts',
      bandsCount: bands.length,
      bands: bands.map((b) => ({ id: b.id, name: b.name })),
      instructions: {
        fullBackfill: 'npx tsx apps/api/scripts/backfill-band-videos.ts',
        dryRun: 'npx tsx apps/api/scripts/backfill-band-videos.ts --dry-run',
        specificBand: 'npx tsx apps/api/scripts/backfill-band-videos.ts --band-id <id>',
      },
    };
  }

  /**
   * Trigger sync for all content creators
   */
  @Post('sync/all-creators')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger YouTube video sync for all creators (use with caution)' })
  @ApiResponse({ status: 202, description: 'Bulk sync started' })
  async syncAllCreators(@Body() dto: TriggerSyncDto) {
    const creators = await this.db.contentCreator.findMany({
      where: {
        youtubeChannelId: { not: null },
      },
      select: { id: true, name: true },
    });

    return {
      message: `Bulk sync initiated for ${creators.length} creators`,
      note: 'For full historical backfill, use the CLI script: npx tsx apps/api/scripts/backfill-creator-videos.ts',
      creatorsCount: creators.length,
      creators: creators.map((c) => ({ id: c.id, name: c.name })),
      instructions: {
        fullBackfill: 'npx tsx apps/api/scripts/backfill-creator-videos.ts',
        dryRun: 'npx tsx apps/api/scripts/backfill-creator-videos.ts --dry-run',
        specificCreator: 'npx tsx apps/api/scripts/backfill-creator-videos.ts --creator-id <id>',
      },
    };
  }

  /**
   * Get sync status and statistics
   */
  @Get('sync/status')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get YouTube sync status and statistics' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved', type: SyncStatusResponseDto })
  async getSyncStatus(): Promise<SyncStatusResponseDto> {
    this.resetDailyQuotaIfNeeded();

    const quotaLimit = this.configService.get<number>('YOUTUBE_QUOTA_LIMIT') || 10000;

    const [totalBands, totalCreators, totalYouTubeVideos, totalCuratedVideos, recentSyncJobs] = await Promise.all([
      this.db.band.count({ where: { youtubeChannelId: { not: null }, isActive: true } }),
      this.db.contentCreator.count({ where: { youtubeChannelId: { not: null } } }),
      this.db.youTubeVideo.count(),
      this.db.video.count(),
      this.db.syncJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { band: { select: { name: true } } },
      }),
    ]);

    return {
      totalBands,
      totalCreators,
      totalYouTubeVideos,
      totalCuratedVideos,
      dailyQuotaUsed: this.dailyQuotaUsed,
      dailyQuotaLimit: quotaLimit,
      dailyQuotaRemaining: quotaLimit - this.dailyQuotaUsed,
      recentSyncJobs: recentSyncJobs.map((job) => ({
        id: job.id,
        entityName: job.band?.name ?? 'All Bands',
        entityType: 'band' as const,
        status: job.status,
        videosAdded: job.videosAdded,
        quotaUsed: job.quotaUsed,
        createdAt: job.createdAt,
        completedAt: job.completedAt ?? undefined,
      })),
    };
  }

  // ==================== VIDEO ENDPOINTS ====================

  /**
   * Search and list YouTube videos
   */
  @Get('videos')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search and list YouTube videos with filters' })
  @ApiResponse({ status: 200, description: 'Videos retrieved', type: YouTubeVideoListResponseDto })
  async listVideos(@Query() query: YouTubeVideoQueryDto): Promise<YouTubeVideoListResponseDto> {
    const repoQuery: RepoQueryDto = {
      bandId: query.bandId,
      creatorId: query.creatorId,
      channelId: query.channelId,
      search: query.search,
      publishedAfter: query.publishedAfter ? new Date(query.publishedAfter) : undefined,
      publishedBefore: query.publishedBefore ? new Date(query.publishedBefore) : undefined,
      syncStatus: query.syncStatus,
      isPromoted: query.isPromoted,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    };

    return this.youtubeVideoRepository.findMany(repoQuery);
  }

  /**
   * Get a specific YouTube video by ID
   */
  @Get('videos/:id')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get specific YouTube video details' })
  @ApiParam({ name: 'id', description: 'YouTube video record ID' })
  @ApiResponse({ status: 200, description: 'Video details retrieved' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVideo(@Param('id') id: string) {
    const video = await this.youtubeVideoRepository.findById(id);
    if (!video) {
      throw new NotFoundException(`YouTube video with ID ${id} not found`);
    }
    return video;
  }

  /**
   * Get YouTube video statistics
   */
  @Get('stats')
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get YouTube video statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats() {
    return this.youtubeVideoRepository.getStats();
  }

  // ==================== HELPER METHODS ====================

  private resetDailyQuotaIfNeeded(): void {
    const now = new Date();
    
    // YouTube API quota resets at midnight Pacific Time
    if (now >= this.quotaResetTime) {
      this.dailyQuotaUsed = 0;
      
      // Set next reset time to next midnight Pacific
      const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const nextMidnight = new Date(pacificNow);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      this.quotaResetTime = nextMidnight;
    }
  }
}
