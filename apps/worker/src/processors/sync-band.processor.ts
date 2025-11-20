import { Job } from 'bullmq';
import { DatabaseService } from '../services/database.service';
import { YouTubeService } from '../services/youtube.service';

// Use your existing interface
export interface SyncBandJobData {
  bandId: string;
  syncType: 'full' | 'incremental';
}

export class SyncBandProcessor {
  constructor(
    private readonly database: DatabaseService,
    private readonly youtube: YouTubeService,
  ) {}

  // Handle single band sync job
  async processSingleBand(job: Job<SyncBandJobData>) {
    const { bandId, syncType } = job.data;
    const forceSync = syncType === 'full';

    await job.updateProgress({ stage: 'starting' });

    try {
      // Get band info
      const band = await this.database.band.findUnique({
        where: { id: bandId },
        include: { videos: { select: { youtubeId: true } } },
      });

      if (!band) {
        throw new Error(`Band with ID ${bandId} not found`);
      }

      console.log(`🎵 Starting ${syncType} sync for: ${band.name}`);

      // Update band status
      await this.database.band.update({
        where: { id: bandId },
        data: { syncStatus: 'IN_PROGRESS' },
      });

      // Determine sync strategy
      const strategy = this.determineSyncStrategy(band);
      
      // Fetch videos
      const videos = await this.fetchVideos(band, strategy, job);
      
      // Process videos
      const result = await this.processVideos(videos, bandId, forceSync, job);

      // Update completion status
      await this.database.band.update({
        where: { id: bandId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'COMPLETED',
        },
      });

      await job.updateProgress({ stage: 'complete', ...result });
      console.log(`✅ Sync completed for ${band.name}: ${result.saved} videos`);

      return result;

    } catch (error) {
      await this.database.band.update({
        where: { id: bandId },
        data: { syncStatus: 'FAILED' },
      });
      
      console.error(`❌ Sync failed for band ${bandId}:`, error);
      throw error;
    }
  }

  // Handle sync all bands job
  async processAllBands(job: Job) {
    await job.updateProgress({ stage: 'fetching_bands' });

    const bands = await this.database.band.findMany({
      where: {
        isActive: true,
        OR: [
          { youtubeChannelId: { not: null } },
          { youtubePlaylistIds: { isEmpty: false } },
        ],
      },
      select: { id: true, name: true },
    });

    console.log(`🎵 Starting bulk sync for ${bands.length} bands`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const band of bands) {
      try {
        await this.processSingleBand({
          ...job,
          data: { bandId: band.id, syncType: 'incremental' },
        } as Job<SyncBandJobData>);
        
        succeeded++;
      } catch (error) {
        console.error(`Failed to sync band ${band.name}:`, error);
        failed++;
      }

      processed++;
      await job.updateProgress({
        stage: 'processing',
        processed,
        total: bands.length,
        succeeded,
        failed,
      });
    }

    const result = { processed, succeeded, failed };
    console.log(`✅ Bulk sync completed:`, result);
    
    return result;
  }

  private determineSyncStrategy(band: any): 'channel' | 'playlist' | 'search' {
    if (band.youtubeChannelId) return 'channel';
    if (band.youtubePlaylistIds.length > 0) return 'playlist';
    return 'search';
  }

  private async fetchVideos(band: any, strategy: string, job: Job) {
    await job.updateProgress({ stage: 'fetching' });
    
    // Implement your video fetching logic here
    const videos: any[] = [];
    const maxVideos = 100;
    
    if (strategy === 'channel' && band.youtubeChannelId) {
      const result = await this.youtube.getChannelVideos(band.youtubeChannelId, maxVideos);
      videos.push(...result.videos);
    } else if (strategy === 'playlist' && band.youtubePlaylistIds.length > 0) {
      const result = await this.youtube.getPlaylistVideos(band.youtubePlaylistIds[0], maxVideos);
      videos.push(...result.videos);
    } else {
      const query = `"${band.name}" marching band`;
      const result = await this.youtube.searchVideos(query, maxVideos);
      videos.push(...result.videos);
    }

    return videos;
  }

  private async processVideos(videos: any[], bandId: string, forceSync: boolean, job: Job) {
    let saved = 0;
    let skipped = 0;
    let processed = 0;

    for (const video of videos) {
      try {
        const existing = await this.database.video.findUnique({
          where: { youtubeId: video.id },
        });

        if (existing && !forceSync) {
          skipped++;
        } else {
          await this.saveVideo(video, bandId);
          saved++;
        }

        processed++;
        await job.updateProgress({
          stage: 'saving',
          processed,
          total: videos.length,
          saved,
          skipped,
        });

      } catch (error) {
        console.error(`Failed to process video ${video.id}:`, error);
      }
    }

    return { processed, saved, skipped };
  }

  private async saveVideo(youtubeVideo: any, bandId: string) {
    const videoData = {
      youtubeId: youtubeVideo.id,
      title: youtubeVideo.title,
      description: youtubeVideo.description || null,
      duration: parseInt(youtubeVideo.duration) || 0,
      thumbnailUrl: youtubeVideo.thumbnailUrl,
      viewCount: youtubeVideo.viewCount || 0,
      likeCount: youtubeVideo.likeCount || 0,
      publishedAt: new Date(youtubeVideo.publishedAt),
      tags: this.extractTags(youtubeVideo.title, youtubeVideo.description || ''),
      band: { connect: { id: bandId } },
    };

    await this.database.video.upsert({
      where: { youtubeId: youtubeVideo.id },
      create: videoData,
      update: {
        viewCount: youtubeVideo.viewCount || 0,
        likeCount: youtubeVideo.likeCount || 0,
        updatedAt: new Date(),
      },
    });
  }

  private extractTags(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const tags: string[] = [];

    const commonTerms = [
      '5th quarter', 'field show', 'stand battle', 'homecoming', 
      'parade', 'halftime', 'battle of the bands', 'concert'
    ];

    commonTerms.forEach(term => {
      if (text.includes(term)) {
        tags.push(term.replace(/\s+/g, '-'));
      }
    });

    return [...new Set(tags)];
  }
}