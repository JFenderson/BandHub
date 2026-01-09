import { ConfigService } from '@nestjs/config';
import { CacheService } from '@bandhub/cache';
import { VideosRepository } from './videos.repository';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './dto';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName } from '@hbcu-band-hub/shared-types';
import { PrismaService } from '@bandhub/database';

/**
 * Production VideosService with full-text search and enhanced caching
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  private readonly CACHE_TTL = {
    VIDEO_LIST: 300,
    VIDEO_DETAIL: 600,
    VIDEO_STATS: 3600,
    POPULAR_VIDEOS: 1800,
    SEARCH_RESULTS: 300,
  };

  constructor(
    private readonly videosRepository: VideosRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async findAll(query: VideoQueryDto) {
    const cacheKey = this.buildQueryCacheKey(query);
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for videos query: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for videos query: ${cacheKey}`);

    // Convert category enum to categoryId if provided
    let categoryId = query.categoryId;
    if (query.category && !categoryId) {
      categoryId = await this.getCategoryIdFromEnum(query.category);
    }

    // Build modified query with categoryId
    const modifiedQuery = {
      ...query,
      categoryId,
    };

    // Use full-text search for search queries with 3+ characters
    const useFullTextSearch = query.search && query.search.trim().length >= 3;

    const result = useFullTextSearch
      ? await this.videosRepository.fullTextSearch(
          query.search!,
          {
            bandId: modifiedQuery.bandId,
            categoryId: modifiedQuery.categoryId,
            includeHidden: modifiedQuery.includeHidden,
          },
          modifiedQuery.page,
          modifiedQuery.limit,
        )
      : await this.videosRepository.findMany(modifiedQuery);

    await this.cacheService.set(cacheKey, result, this.CACHE_TTL.VIDEO_LIST);

    return result;
  }

  /**
   * Convert category enum (e.g., 'FIFTH_QUARTER') to category ID
   */
  private async getCategoryIdFromEnum(categoryEnum: string): Promise<string | undefined> {
    if (!categoryEnum) return undefined;
    
    // Convert enum format to slug format
    // FIFTH_QUARTER → fifth-quarter
    // FIELD_SHOW → field-show
    const slug = categoryEnum.toLowerCase().replace(/_/g, '-');
    
    const category = await this.prismaService.category.findFirst({
      where: { slug },
      select: { id: true }
    });
    
    if (!category) {
      this.logger.warn(`Category not found for enum: ${categoryEnum} (slug: ${slug})`);
      return undefined;
    }
    
    return category.id;
  }

  async findById(id: string) {
    const cacheKey = `video:${id}`;
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for video: ${id}`);
      return cached;
    }

    this.logger.debug(`Cache miss for video: ${id}`);

    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    await this.cacheService.set(cacheKey, video, this.CACHE_TTL.VIDEO_DETAIL);

    return video;
  }

  async create(data: CreateVideoDto) {
    const existing = await this.videosRepository.findByYoutubeId(data.youtubeId);
    if (existing) {
      throw new BadRequestException(`Video with YouTube ID ${data.youtubeId} already exists`);
    }

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
      band: { connect: { id: data.bandId } },
      ...(data.categoryId && { category: { connect: { id: data.categoryId } } }),
      ...(data.opponentBandId && { opponentBand: { connect: { id: data.opponentBandId } } }),
    };

    const video = await this.videosRepository.create(createData);
    await this.invalidateVideosCaches(video.bandId, video.categoryId);

    return video;
  }

  async update(id: string, data: UpdateVideoDto) {
    const existing = await this.videosRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    const video = await this.videosRepository.update(id, data);

    await this.cacheService.del(`video:${id}`);
    await this.invalidateVideosCaches(video.bandId, video.categoryId);

    return video;
  }

  async delete(id: string) {
    const existing = await this.videosRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    await this.videosRepository.delete(id);

    await this.cacheService.del(`video:${id}`);
    await this.invalidateVideosCaches(existing.band.id, existing.category?.id);

    return { message: 'Video deleted successfully' };
  }

  async findHidden() {
    const cacheKey = 'videos:hidden';
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.videosRepository.findHidden();
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL.VIDEO_LIST);

    return result;
  }

  async hideVideo(id: string, reason: string) {
    const result = await this.update(id, { isHidden: true, hideReason: reason });
    await this.cacheService.del('videos:hidden');
    return result;
  }

  async unhideVideo(id: string) {
    const result = await this.update(id, { isHidden: false, hideReason: null });
    await this.cacheService.del('videos:hidden');
    return result;
  }

  async getStats() {
    const cacheKey = 'videos:stats';
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const stats = await this.videosRepository.getVideoStats();
    await this.cacheService.set(cacheKey, stats, this.CACHE_TTL.VIDEO_STATS);

    return stats;
  }

  async getPopularByBand(bandId: string, limit: number = 10) {
    const cacheKey = `videos:popular:band:${bandId}:${limit}`;
    
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const videos = await this.videosRepository.getPopularByBand(bandId, limit);
    await this.cacheService.set(cacheKey, videos, this.CACHE_TTL.POPULAR_VIDEOS);

    return videos;
  }

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

  async warmCache() {
    this.logger.log('Starting cache warming...');

    try {
      await this.findAll({ sortBy: 'publishedAt', sortOrder: 'desc', page: 1, limit: 20 });
      await this.findAll({ sortBy: 'viewCount', sortOrder: 'desc', page: 1, limit: 20 });
      await this.getStats();

      this.logger.log('Cache warming completed successfully');
    } catch (error) {
      this.logger.error('Cache warming failed', error);
    }
  }

  private buildQueryCacheKey(query: VideoQueryDto): string {
    const parts = ['videos'];
    
    if (query.bandId) parts.push(`band:${query.bandId}`);
    if (query.bandSlug) parts.push(`bandSlug:${query.bandSlug}`);
    if (query.category) parts.push(`category:${query.category}`);  // ADD THIS
    if (query.categoryId) parts.push(`cat:${query.categoryId}`);
    if (query.categorySlug) parts.push(`catSlug:${query.categorySlug}`);
    if (query.opponentBandId) parts.push(`opp:${query.opponentBandId}`);
    if (query.eventYear) parts.push(`year:${query.eventYear}`);
    if (query.eventName) parts.push(`event:${query.eventName}`);
    if (query.search) parts.push(`q:${query.search}`);
    if (query.tags) parts.push(`tags:${query.tags}`);
    if (query.includeHidden) parts.push('hidden:true');
    
    parts.push(`sort:${query.sortBy || 'publishedAt'}:${query.sortOrder || 'desc'}`);
    parts.push(`page:${query.page || 1}`);
    parts.push(`limit:${query.limit || 20}`);
    
    return parts.join(':');
  }

  private async invalidateVideosCaches(bandId?: string, categoryId?: string) {
    const patterns: string[] = [
      'videos:stats',
      'videos:hidden',
      'videos:*:page:*',
    ];

    if (bandId) {
      patterns.push(`videos:band:${bandId}:*`);
      patterns.push(`videos:popular:band:${bandId}:*`);
    }

    if (categoryId) {
      patterns.push(`videos:cat:${categoryId}:*`);
    }

    for (const pattern of patterns) {
      try {
        await this.cacheService.delPattern(pattern);
      } catch (error) {
        this.logger.error(`Failed to invalidate cache pattern: ${pattern}`, error);
      }
    }
  }
}