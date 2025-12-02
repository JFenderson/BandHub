import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { VideosRepository } from './videos.repository';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class VideosService {
  constructor(
    private readonly videosRepository: VideosRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly prismaService: DatabaseService,
  ) {}

  async findAll(query: VideoQueryDto) {
    // Create a cache key from the query parameters
    const cacheKey = `videos:${JSON.stringify(query)}`;
    
    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const result = await this.videosRepository.findMany(query);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  async findById(id: string) {
    const cacheKey = `video:${id}`;
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, video, 600);

    return video;
  }

  async create(data: CreateVideoDto) {
    // Check if video already exists
    const existing = await this.videosRepository.findByYoutubeId(data.youtubeId);
    if (existing) {
      throw new BadRequestException(`Video with YouTube ID ${data.youtubeId} already exists`);
    }

    // Convert to proper Prisma input format
    const createData = {
      youtubeId: data.youtubeId,
      title: data.title,
      description: data.description,
      duration: data.duration,
      thumbnailUrl: data.thumbnailUrl,
      viewCount: data.viewCount,
      likeCount: data.likeCount,
      publishedAt: new Date(data.publishedAt),
      tags: data.tags || [],
      eventName: data.eventName,
      eventYear: data.eventYear,
      qualityScore: data.qualityScore,
      band: {
        connect: { id: data.bandId }
      },
      ...(data.categoryId && {
        category: { connect: { id: data.categoryId } }
      }),
      ...(data.opponentBandId && {
        opponentBand: { connect: { id: data.opponentBandId } }
      }),
    };

    const video = await this.videosRepository.create(createData);

    // Invalidate related caches
    await this.invalidateVideosCaches();

    return video;
  }

  async update(id: string, data: UpdateVideoDto) {
    // Check if video exists
    const existing = await this.videosRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    const video = await this.videosRepository.update(id, data);

    // Invalidate caches
    await this.invalidateVideosCaches();
    await this.cacheService.del(`video:${id}`);

    return video;
  }

  async delete(id: string) {
    // Check if video exists
    const existing = await this.videosRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    await this.videosRepository.delete(id);

    // Invalidate caches
    await this.invalidateVideosCaches();
    await this.cacheService.del(`video:${id}`);

    return { message: 'Video deleted successfully' };
  }

  // Admin-specific methods
  async findHidden() {
    return this.videosRepository.findHidden();
  }

  async hideVideo(id: string, reason: string) {
    return this.update(id, { isHidden: true, hideReason: reason });
  }

  async unhideVideo(id: string) {
    return this.update(id, { isHidden: false, hideReason: null });
  }

  async getStats() {
    const cacheKey = 'videos:stats';
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await this.videosRepository.getVideoStats();

    // Cache stats for 1 hour
    await this.cacheService.set(cacheKey, stats, 3600);

    return stats;
  }

  // Search method with advanced full-text search
  async search(query: string, filters?: Partial<VideoQueryDto>) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters long');
    }

    const searchQuery: VideoQueryDto = {
      search: query.trim(),
      ...filters,
    };

    return this.findAll(searchQuery);
  }

  private async invalidateVideosCaches() {
    // Clear all video list caches (this is a simplified approach)
    // In a production system, you might want more sophisticated cache invalidation
    const patterns = ['videos:*', 'videos:stats'];
    
    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}