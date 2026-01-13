import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { Band, Video, Category, Prisma, SyncStatus, SyncJobType, SyncJobStatus } from '@prisma/client';
import { YouTubeVideoMetadata } from '@hbcu-band-hub/shared-types';
import { 
  CATEGORY_PATTERNS, 
  IRRELEVANT_PATTERNS,
  EVENT_PATTERNS,
} from '@hbcu-band-hub/shared-types';

export interface VideoUpsertResult {
  video: Video;
  isNew: boolean;
  wasUpdated: boolean;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private categoryCache: Map<string, Category> = new Map();
  
  constructor(private prisma: PrismaService) {
    this.loadCategoryCache();
  }

    get band() {
    return this.prisma.band;
  }
  
  get video() {
    return this.prisma.video;
  }
  
  get category() {
    return this.prisma.category;
  }
  
  get youTubeVideo() {
    return this.prisma.youTubeVideo;
  }
  
  get contentCreator() {
    return this.prisma.contentCreator;
  }
  /**
   * Load categories into memory for fast lookup
   */
  private async loadCategoryCache() {
    const categories = await this.prisma.category.findMany();
    for (const category of categories) {
      this.categoryCache.set(category.slug, category);
    }
    this.logger.log(`Loaded ${categories.length} categories into cache`);
  }
  
  /**
   * Get all bands that are active and eligible for syncing
   */
  async getActiveBands(): Promise<Band[]> {
    return this.prisma.band.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        lastSyncAt: 'asc',  // Prioritize bands that haven't been synced recently
      },
    });
  }
  
  /**
   * Get a single band by ID
   */
  async getBandById(bandId: string): Promise<Band | null> {
    return this.prisma.band.findUnique({
      where: { id: bandId },
    });
  }
  
  /**
   * Check if a video already exists
   */
  async videoExists(youtubeId: string): Promise<boolean> {
    const count = await this.prisma.video.count({
      where: { youtubeId },
    });
    return count > 0;
  }
  
  /**
   * Get existing video IDs for deduplication
   */
  async getExistingVideoIds(youtubeIds: string[]): Promise<Set<string>> {
    const videos = await this.prisma.video.findMany({
      where: {
        youtubeId: { in: youtubeIds },
      },
      select: { youtubeId: true },
    });
    
    return new Set(videos.map(v => v.youtubeId));
  }
  
  /**
   * Create or update a video from YouTube metadata
   * This matches your actual schema structure
   */
  async upsertVideo(
    metadata: YouTubeVideoMetadata,
    bandId: string,
  ): Promise<VideoUpsertResult> {
    const existingVideo = await this.prisma.video.findUnique({
      where: { youtubeId: metadata.id },
    });
    
  const thumbnailUrl = 
    metadata.snippet.thumbnails.high?.url ||
    metadata.snippet.thumbnails.medium?.url ||
    metadata.snippet.thumbnails.default?.url ||
    '';

    // Detect category from title and description
    const categorySlug = this.detectCategorySlug(
      metadata.snippet.title,
      metadata.snippet.description || ''
    );
    
    const category = this.categoryCache.get(categorySlug);
    
    // Extract event information
    const eventInfo = this.extractEventInfo(
      metadata.snippet.title,
      metadata.snippet.description || ''
    );
    
    // Calculate quality score (0-100)
    const qualityScore = this.calculateQualityScore(
      metadata.snippet.title,
      metadata.snippet.description || '',
      metadata.snippet.tags || [],
      parseInt(metadata.statistics.viewCount, 10)
    );
    
    // Generate tags
    const tags = this.generateTags(
      metadata.snippet.tags || [],
      metadata.snippet.title,
      categorySlug,
      eventInfo
    );
    
    // Parse duration
    const durationSeconds = this.parseDuration(metadata.contentDetails.duration);
    
    // Prepare video data matching your schema
  const videoData: Prisma.VideoCreateInput = {
    youtubeId: metadata.id,
    title: metadata.snippet.title,
    description: metadata.snippet.description || null,
    thumbnailUrl,  // ← Now safely handles nulls
    duration: durationSeconds,
    publishedAt: new Date(metadata.snippet.publishedAt),
    viewCount: parseInt(metadata.statistics.viewCount, 10) || 0,
    likeCount: metadata.statistics.likeCount 
      ? parseInt(metadata.statistics.likeCount, 10) 
      : 0,
      eventName: eventInfo.eventName,
      eventYear: eventInfo.eventYear,
      tags,
      qualityScore,
      isHidden: qualityScore < 30,  // Auto-hide low-quality videos
      band: { connect: { id: bandId } },
      category: category ? { connect: { id: category.id } } : undefined,
    };
    
    if (existingVideo) {
      // Update existing video
      const updatedVideo = await this.prisma.video.update({
        where: { id: existingVideo.id },
        data: {
          title: metadata.snippet.title,
          description: metadata.snippet.description || null,
          viewCount: parseInt(metadata.statistics.viewCount, 10),
          likeCount: metadata.statistics.likeCount 
            ? parseInt(metadata.statistics.likeCount, 10) 
            : 0,
          // Only update category if it wasn't manually set
          // You'll need to add a categoryManuallySet field or track this differently
          ...(category ? { categoryId: category.id } : {}),
        },
      });
      
      return {
        video: updatedVideo,
        isNew: false,
        wasUpdated: true,
      };
    } else {
      // Create new video
      const newVideo = await this.prisma.video.create({
        data: videoData,
      });
      
      return {
        video: newVideo,
        isNew: true,
        wasUpdated: false,
      };
    }
  }
  
  /**
   * Update band sync status
   */
  async updateBandSyncStatus(
    bandId: string,
    status: {
      lastSyncAt: Date;
      syncStatus: SyncStatus;
    }
  ): Promise<void> {
    await this.prisma.band.update({
      where: { id: bandId },
      data: status,
    });
  }
  
  /**
   * Create a sync job record for tracking
   */
  async createSyncJob(data: {
    bandId?: string;
    jobType: SyncJobType;
  }): Promise<{ id: string }> {
    const job = await this.prisma.syncJob.create({
      data: {
        bandId: data.bandId,
        jobType: data.jobType,
        status: SyncJobStatus.QUEUED,
      },
    });
    
    return { id: job.id };
  }
  
  /**
   * Update sync job status
   */
  async updateSyncJob(
    jobId: string,
    data: {
      status: SyncJobStatus;
      videosFound?: number;
      videosAdded?: number;
      videosUpdated?: number;
      errors?: string[];
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data,
    });
  }
  
  /**
   * Find duplicate videos
   */
  async findDuplicates(): Promise<Array<{ youtubeId: string; count: number }>> {
    const duplicates = await this.prisma.$queryRaw<Array<{ youtube_id: string; count: bigint }>>`
      SELECT youtube_id, COUNT(*) as count
      FROM videos
      GROUP BY youtube_id
      HAVING COUNT(*) > 1
    `;
    
    return duplicates.map(d => ({
      youtubeId: d.youtube_id,
      count: Number(d.count),
    }));
  }
  
  /**
   * Remove duplicate videos, keeping the oldest
   */
  async removeDuplicates(dryRun: boolean = false): Promise<number> {
    const duplicates = await this.findDuplicates();
    let removedCount = 0;
    
    for (const dup of duplicates) {
      const videos = await this.prisma.video.findMany({
        where: { youtubeId: dup.youtubeId },
        orderBy: { createdAt: 'asc' },
      });
      
      const toDelete = videos.slice(1);
      
      if (!dryRun) {
        await this.prisma.video.deleteMany({
          where: {
            id: { in: toDelete.map(v => v.id) },
          },
        });
      }
      
      removedCount += toDelete.length;
    }
    
    return removedCount;
  }
  
  /**
   * Detect category slug from video content
   * Returns slug to match your Category model
   */
  private detectCategorySlug(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    // Map from your constant patterns to actual category slugs in your DB
    // You'll need to ensure these slugs exist in your categories table
    const categoryMapping: Record<string, string> = {
      'fifth-quarter': '5th-quarter',
      'stand-battle': 'stand-battle',
      'field-show': 'field-show',
      'halftime': 'halftime',
      'pregame': 'pregame',
      'parade': 'parade',
      'practice': 'practice',
      'concert': 'concert',
    };
    
    for (const { category, patterns } of CATEGORY_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return categoryMapping[category] || 'other';
        }
      }
    }
    
    return 'other';
  }
  
  /**
   * Extract event information
   */
  private extractEventInfo(
    title: string,
    description: string
  ): { eventName: string | null; eventYear: number | null } {
    const text = `${title} ${description}`;
    
    // Try to find event name with year
    const eventMatch = text.match(EVENT_PATTERNS.eventYear);
    let eventName: string | null = null;
    let eventYear: number | null = null;
    
    if (eventMatch) {
      eventName = `${eventMatch[1]} ${eventMatch[2]}`;
      eventYear = parseInt(eventMatch[2], 10);
    }
    
    // Try to extract year from title if not found
    if (!eventYear) {
      const yearMatch = title.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        eventYear = parseInt(yearMatch[1], 10);
      }
    }
    
    return { eventName, eventYear };
  }
  
  /**
   * Calculate quality score (0-100)
   * Higher scores = more relevant, higher quality content
   */
  private calculateQualityScore(
    title: string,
    description: string,
    tags: string[],
    viewCount: number
  ): number {
    const text = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
    let score = 50;  // Start neutral
    
    // Positive indicators
    const positivePatterns = [
      { pattern: /hbcu/i, points: 20 },
      { pattern: /marching\s*band/i, points: 15 },
      { pattern: /drum\s*major/i, points: 10 },
      { pattern: /drumline/i, points: 10 },
      { pattern: /battle\s*of.*bands/i, points: 15 },
      { pattern: /homecoming/i, points: 10 },
      { pattern: /swac|meac/i, points: 10 },
      { pattern: /classic/i, points: 5 },
    ];
    
    for (const { pattern, points } of positivePatterns) {
      if (pattern.test(text)) {
        score += points;
      }
    }
    
    // Negative indicators
    for (const pattern of IRRELEVANT_PATTERNS) {
      if (pattern.test(text)) {
        score -= 30;
      }
    }
    
    // Boost based on view count (logarithmic scale)
    if (viewCount > 1000) {
      score += Math.min(10, Math.log10(viewCount / 1000) * 5);
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  /**
   * Generate tags for the video
   */
  private generateTags(
    youtubeTags: string[],
    title: string,
    categorySlug: string,
    eventInfo: { eventName: string | null; eventYear: number | null }
  ): string[] {
    const tags = new Set<string>();
    
    // Add YouTube tags (filtered)
    for (const tag of youtubeTags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized.length > 2 && normalized.length < 50) {
        tags.add(normalized);
      }
    }
    
    // Add category
    if (categorySlug !== 'other') {
      tags.add(categorySlug);
    }
    
    // Add event name
    if (eventInfo.eventName) {
      tags.add(eventInfo.eventName.toLowerCase());
    }
    
    // Add year
    if (eventInfo.eventYear) {
      tags.add(eventInfo.eventYear.toString());
    }
    
    // Extract common HBCU band terms
    const bandTerms = ['hbcu', 'swac', 'meac', 'marching band', 'drum major', 'drumline'];
    const titleLower = title.toLowerCase();
    for (const term of bandTerms) {
      if (titleLower.includes(term)) {
        tags.add(term);
      }
    }
    
    return Array.from(tags).slice(0, 20);
  }
  
  /**
   * Parse ISO 8601 duration to seconds
   */
  private parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categoryCache.get(slug) || null;
  }
}