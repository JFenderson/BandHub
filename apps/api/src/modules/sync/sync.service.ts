    /**
     * Utility: Detect bands in video title/description using band list
     */
    private static BAND_LIST = [
      { id: 'alabama-am-maroon-white', name: 'Marching Maroon and White', schoolName: 'Alabama A&M University', abbreviations: ['AAMU', 'Maroon & White'] },
      { id: 'mighty-marching-hornets', name: 'Mighty Marching Hornets', schoolName: 'Alabama State University', abbreviations: ['ASU', 'Hornets'] },
      { id: 'purple-marching-machine', name: 'Purple Marching Machine', schoolName: 'Miles College', abbreviations: ['Miles', 'PMM'] },
      { id: 'marching-crimson-piper', name: 'Marching Crimson Piper', schoolName: 'Tuskegee University', abbreviations: ['Tuskegee', 'Crimson Piper'] },
      { id: 'uapb-marching-musical-machine', name: 'Marching Musical Machine', schoolName: 'University of Arkansas at Pine Bluff', abbreviations: ['UAPB', 'Musical Machine'] },
      { id: 'approaching-storm', name: 'Approaching Storm', schoolName: 'Delaware State University', abbreviations: ['DSU', 'Approaching Storm'] },
      { id: 'showtime-marching-band', name: 'Showtime Marching Band', schoolName: 'Howard University', abbreviations: ['Howard', 'Showtime'] },
      { id: 'marching-wildcats', name: 'Marching Wildcats', schoolName: 'Bethune-Cookman University', abbreviations: ['BCU', 'Wildcats'] },
      { id: 'marching-100', name: 'Marching 100', schoolName: 'Florida A&M University', abbreviations: ['FAMU', 'Marching 100'] },
      { id: 'albany-state-marching-rams', name: 'Marching Rams', schoolName: 'Albany State University', abbreviations: ['ASU', 'Rams'] },
      { id: 'mighty-marching-panther-band', name: 'Mighty Marching Panther Band', schoolName: 'Clark Atlanta University', abbreviations: ['CAU', 'Panther Band'] },
      { id: 'blue-machine', name: 'Blue Machine', schoolName: 'Fort Valley State University', abbreviations: ['FVSU', 'Blue Machine'] },
      { id: 'house-of-funk', name: 'House of Funk', schoolName: 'Morehouse College', abbreviations: ['Morehouse', 'House of Funk'] },
      { id: 'powerhouse-of-the-south', name: 'Powerhouse of the South', schoolName: 'Savannah State University', abbreviations: ['SSU', 'Powerhouse'] },
      { id: 'world-famed', name: 'World Famed', schoolName: 'Grambling State University', abbreviations: ['GSU', 'World Famed'] },
      { id: 'human-jukebox', name: 'Human Jukebox', schoolName: 'Southern University', abbreviations: ['SU', 'Human Jukebox'] },
      { id: 'bowie-state-marching-bulldogs', name: 'Marching Bulldogs', schoolName: 'Bowie State University', abbreviations: ['BSU', 'Bulldogs'] },
      { id: 'magnificent-marching-machine', name: 'Magnificent Marching Machine', schoolName: 'Morgan State University', abbreviations: ['MSU', 'MMM'] },
      { id: 'sounds-of-dyn-o-mite', name: 'Sounds of Dyn-O-Mite', schoolName: 'Alcorn State University', abbreviations: ['ASU', 'Dyn-O-Mite'] },
      { id: 'sonic-boom-of-the-south', name: 'Sonic Boom of the South', schoolName: 'Jackson State University', abbreviations: ['JSU', 'Sonic Boom'] },
      { id: 'mean-green-marching-machine', name: 'Mean Green Marching Machine', schoolName: 'Mississippi Valley State University', abbreviations: ['MVSU', 'Mean Green'] },
      { id: 'sound-of-class', name: 'Sound of Class', schoolName: 'Elizabeth City State University', abbreviations: ['ECSU', 'Sound of Class'] },
      { id: 'blue-and-white-machine', name: 'Blue and White Machine', schoolName: 'Fayetteville State University', abbreviations: ['FSU', 'Blue & White'] },
      { id: 'blue-and-gold-marching-machine', name: 'Blue and Gold Marching Machine', schoolName: 'North Carolina A&T State University', abbreviations: ['NCAT', 'BGMM'] },
      { id: 'sound-machine', name: 'Sound Machine', schoolName: 'North Carolina Central University', abbreviations: ['NCCU', 'Sound Machine'] },
      { id: 'red-sea-of-sound', name: 'Red Sea of Sound', schoolName: 'Winston-Salem State University', abbreviations: ['WSSU', 'Red Sea'] },
      { id: 'marching-marauders', name: 'Marching Marauders', schoolName: 'Central State University', abbreviations: ['CSU', 'Marauders'] },
      { id: 'marching-pride', name: 'Marching Pride', schoolName: 'Langston University', abbreviations: ['LU', 'Pride'] },
      { id: '101-band', name: '101', schoolName: 'South Carolina State University', abbreviations: ['SCSU', '101'] },
      { id: 'aristocrat-of-bands', name: 'Aristocrat of Bands', schoolName: 'Tennessee State University', abbreviations: ['TSU', 'Aristocrat'] },
      { id: 'marching-storm', name: 'Marching Storm', schoolName: 'Prairie View A&M University', abbreviations: ['PVAMU', 'Storm'] },
      { id: 'ocean-of-soul', name: 'Ocean of Soul', schoolName: 'Texas Southern University', abbreviations: ['TSU', 'Ocean of Soul'] },
      { id: 'the-force', name: 'Force', schoolName: 'Hampton University', abbreviations: ['HU', 'Force'] },
      { id: 'spartan-legion', name: 'Spartan Legion', schoolName: 'Norfolk State University', abbreviations: ['NSU', 'Spartan Legion'] },
      { id: 'trojan-explosion', name: 'Trojan Explosion', schoolName: 'Virginia State University', abbreviations: ['VSU', 'Trojan Explosion'] }
    ];

    /**
     * Detect bands in a video title/description
     * Returns primary band, opponent band, and match details
     */
    static detectBands(text: string): {
      bandId: string | null;
      opponentBandId: string | null;
      matchDetails: any;
    } {
      const matches: { bandId: string; score: number; details: string[] }[] = [];
      const lowerText = text.toLowerCase();
      for (const band of this.BAND_LIST) {
        let score = 0;
        const details: string[] = [];
        // Check name
        if (lowerText.includes(band.name.toLowerCase())) {
          score += 5;
          details.push(`Matched name: ${band.name}`);
        }
        // Check school name
        if (lowerText.includes(band.schoolName.toLowerCase())) {
          score += 3;
          details.push(`Matched school: ${band.schoolName}`);
        }
        // Check abbreviations
        for (const abbr of band.abbreviations) {
          if (lowerText.includes(abbr.toLowerCase())) {
            score += 2;
            details.push(`Matched abbreviation: ${abbr}`);
          }
        }
        if (score > 0) {
          matches.push({ bandId: band.id, score, details });
        }
      }
      // Sort matches by score
      matches.sort((a, b) => b.score - a.score);
      const bandId = matches[0]?.bandId || null;
      const opponentBandId = matches[1]?.score && matches[1].score >= 3 ? matches[1].bandId : null;
      return {
        bandId,
        opponentBandId,
        matchDetails: matches,
      };
    }
  /**
   * Sync all videos from a content creator's channel
   */
  async syncCreatorChannel(creatorId: string, options?: {
    fullSync?: boolean;
    publishedAfter?: Date;
    publishedBefore?: Date;
    maxVideos?: number;
  }) {
    // 1. Fetch creator from DB
    const creator = await this.database.contentCreator.findUnique({ where: { id: creatorId } });
    if (!creator) {
      throw new Error(`Content creator not found: ${creatorId}`);
    }

    // 2. Fetch videos from YouTube API (pseudo-code, replace with actual API call)
    // const videos = await fetchYoutubeVideos(creator.youtubeChannelId, options);
    const videos: any[] = []; // TODO: Replace with actual YouTube API results

    let added = 0;
    let updated = 0;
    let errors: any[] = [];

    for (const video of videos) {
      // 3. Detect bands in video
      const detection = SyncService.detectBands(`${video.title} ${video.description || ''}`);
      // 4. Upsert video with creator attribution
      try {
        await this.upsertVideoWithCreator(video, detection.bandId, creatorId, detection.opponentBandId);
        added++;
      } catch (err) {
        errors.push({ videoId: video.id, error: err.message });
      }
    }

    // 5. Update creator sync timestamps
    await this.database.contentCreator.update({
      where: { id: creatorId },
      data: {
        lastSyncedAt: new Date(),
        videosInOurDb: added,
      },
    });

    // 6. Return summary
    return {
      creatorId,
      added,
      updated,
      errors,
      message: `Synced ${added} videos for creator ${creator.name}`,
    };
  }

  /**
   * Sync all featured/verified creators (scheduled job)
   */
  async syncAllCreators() {
    // TODO: Query all featured/verified creators, call syncCreatorChannel for each
    // Rate limit between creators, track quota
    return { message: 'Bulk creator sync not yet implemented.' };
  }

  /**
   * Analyze video title/description to determine which band(s) are featured
   */
  detectBandsInVideo(videoData: { title: string; description?: string; }): {
    bandId: string | null;
    opponentBandId?: string | null;
    matchDetails: any;
  } {
    // TODO: Implement band detection logic using band names, school names, abbreviations
    return { bandId: null, opponentBandId: null, matchDetails: {} };
  }

  /**
   * Save video with creator attribution
   */
  async upsertVideoWithCreator(videoData: any, bandId: string | null, creatorId: string, opponentBandId?: string | null) {
    // TODO: Upsert video in DB, link to band and creator
    return { message: 'Upsert video with creator not yet implemented.' };
  }
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