import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService, ReadReplicaService } from '@bandhub/database';
import { CacheService } from '@bandhub/cache';

export interface RelatedVideoFilters {
  limit?: number;
  userId?: string; // Optional: if provided, exclude watched videos
}

export interface RelatedVideo {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  qualityScore: number;
  similarityScore: number;
  matchReason: string;
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface BecauseYouWatchedSection {
  sourceVideo: {
    id: string;
    title: string;
    thumbnailUrl: string;
  };
  videos: RelatedVideo[];
}

export interface RelatedVideosResponse {
  videos: RelatedVideo[];
  becauseYouWatched?: BecauseYouWatchedSection[];
  fallbackReason?: string;
}

interface VideoForScoring {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  qualityScore: number;
  bandId: string;
  categoryId: string | null;
  eventName: string | null;
  eventYear: number | null;
  tags: string[];
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

/**
 * VideoRecommendationsService - Calculates related videos using content-based
 * and collaborative filtering algorithms
 *
 * Similarity Score Formula:
 * - Same Band: 40%
 * - Same Category: 30%
 * - Same Event: 20%
 * - Matching Tags: 10%
 */
@Injectable()
export class VideoRecommendationsService {
  private readonly logger = new Logger(VideoRecommendationsService.name);

  private readonly CACHE_TTL = {
    RELATED_VIDEOS: 21600, // 6 hours
    BECAUSE_YOU_WATCHED: 21600, // 6 hours
  };

  private readonly CACHE_KEY_PREFIX = 'videos:related:';

  // Weights for similarity calculation
  private readonly SIMILARITY_WEIGHTS = {
    sameBand: 0.4,
    sameCategory: 0.3,
    sameEvent: 0.2,
    matchingTags: 0.1,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly readReplica: ReadReplicaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get related videos for a specific video
   * Implements content-based filtering with weighted similarity scores
   */
  async getRelatedVideos(
    videoId: string,
    filters: RelatedVideoFilters = {},
  ): Promise<RelatedVideosResponse> {
    const { limit = 10, userId } = filters;

    // Build cache key (different for authenticated vs anonymous)
    const cacheKey = this.buildCacheKey(videoId, limit, userId);

    // Check cache first (only for anonymous users or if userId provided)
    if (!userId) {
      const cached = await this.cache.get<RelatedVideosResponse>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for related videos: ${cacheKey}`);
        return cached;
      }
    }

    this.logger.debug(`Cache miss for related videos: ${cacheKey}`);

    // Get the source video
    const sourceVideo = await this.getVideoById(videoId);
    if (!sourceVideo) {
      throw new NotFoundException(`Video with ID ${videoId} not found`);
    }

    // Get watched video IDs if user is authenticated
    let watchedVideoIds: Set<string> = new Set();
    if (userId) {
      watchedVideoIds = await this.getWatchedVideoIds(userId);
    }

    // Calculate related videos using content-based filtering
    const relatedVideos = await this.calculateRelatedVideos(
      sourceVideo,
      limit,
      watchedVideoIds,
    );

    // If not enough related videos, fallback to popular videos in same category
    let fallbackReason: string | undefined;
    if (relatedVideos.length < limit) {
      const needed = limit - relatedVideos.length;
      const existingIds = new Set([sourceVideo.id, ...relatedVideos.map(v => v.id)]);

      const fallbackVideos = await this.getFallbackVideos(
        sourceVideo.categoryId,
        sourceVideo.bandId,
        needed,
        existingIds,
        watchedVideoIds,
      );

      if (fallbackVideos.length > 0) {
        relatedVideos.push(...fallbackVideos);
        fallbackReason = 'Including popular videos from similar categories';
      }
    }

    // Get "Because you watched" sections for authenticated users
    let becauseYouWatched: BecauseYouWatchedSection[] | undefined;
    if (userId) {
      becauseYouWatched = await this.getBecauseYouWatchedSections(
        userId,
        videoId,
        5, // Max 5 sections
        3, // Videos per section
        watchedVideoIds,
      );
    }

    const response: RelatedVideosResponse = {
      videos: relatedVideos.slice(0, limit),
      becauseYouWatched,
      fallbackReason,
    };

    // Cache results for anonymous users
    if (!userId) {
      await this.cache.set(cacheKey, response, this.CACHE_TTL.RELATED_VIDEOS);
    }

    return response;
  }

  /**
   * Calculate similarity score between two videos
   */
  private calculateSimilarityScore(
    sourceVideo: VideoForScoring,
    candidateVideo: VideoForScoring,
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Same band (40%)
    if (sourceVideo.bandId === candidateVideo.bandId) {
      score += this.SIMILARITY_WEIGHTS.sameBand * 100;
      reasons.push('Same band');
    }

    // Same category (30%)
    if (
      sourceVideo.categoryId &&
      candidateVideo.categoryId &&
      sourceVideo.categoryId === candidateVideo.categoryId
    ) {
      score += this.SIMILARITY_WEIGHTS.sameCategory * 100;
      reasons.push('Same category');
    }

    // Same event (20%)
    const sameEvent =
      (sourceVideo.eventName &&
        candidateVideo.eventName &&
        sourceVideo.eventName.toLowerCase() === candidateVideo.eventName.toLowerCase()) ||
      (sourceVideo.eventYear &&
        candidateVideo.eventYear &&
        sourceVideo.eventYear === candidateVideo.eventYear);

    if (sameEvent) {
      score += this.SIMILARITY_WEIGHTS.sameEvent * 100;
      if (sourceVideo.eventName === candidateVideo.eventName) {
        reasons.push('Same event');
      } else {
        reasons.push('Same year');
      }
    }

    // Matching tags (10%)
    if (sourceVideo.tags.length > 0 && candidateVideo.tags.length > 0) {
      const sourceTags = new Set(sourceVideo.tags.map(t => t.toLowerCase()));
      const matchingTags = candidateVideo.tags.filter(t =>
        sourceTags.has(t.toLowerCase())
      );

      if (matchingTags.length > 0) {
        const tagMatchRatio = matchingTags.length / sourceVideo.tags.length;
        score += this.SIMILARITY_WEIGHTS.matchingTags * 100 * Math.min(1, tagMatchRatio);
        reasons.push(`${matchingTags.length} matching tags`);
      }
    }

    return {
      score: Math.round(score * 100) / 100,
      reason: reasons.length > 0 ? reasons.join(', ') : 'Popular video',
    };
  }

  /**
   * Calculate related videos using content-based filtering
   */
  private async calculateRelatedVideos(
    sourceVideo: VideoForScoring,
    limit: number,
    excludeVideoIds: Set<string>,
  ): Promise<RelatedVideo[]> {
    // Fetch candidate videos from same band, category, or with similar tags
    const candidates = await this.readReplica.executeRead((client) =>
      client.video.findMany({
        where: {
          isHidden: false,
          id: { not: sourceVideo.id },
          OR: [
            { bandId: sourceVideo.bandId },
            ...(sourceVideo.categoryId ? [{ categoryId: sourceVideo.categoryId }] : []),
            ...(sourceVideo.eventName ? [{ eventName: { contains: sourceVideo.eventName, mode: 'insensitive' as const } }] : []),
            ...(sourceVideo.tags.length > 0 ? [{ tags: { hasSome: sourceVideo.tags } }] : []),
          ],
        },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          publishedAt: true,
          viewCount: true,
          likeCount: true,
          qualityScore: true,
          bandId: true,
          categoryId: true,
          eventName: true,
          eventYear: true,
          tags: true,
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [
          { viewCount: 'desc' },
          { publishedAt: 'desc' },
        ],
        take: limit * 5, // Fetch more to allow for scoring and filtering
      }),
    );

    // Score and sort candidates
    const scoredVideos = candidates
      .filter(v => !excludeVideoIds.has(v.id))
      .map(candidate => {
        const { score, reason } = this.calculateSimilarityScore(
          sourceVideo,
          candidate as VideoForScoring,
        );
        return {
          ...candidate,
          similarityScore: score,
          matchReason: reason,
        };
      })
      .filter(v => v.similarityScore > 0)
      .sort((a, b) => {
        // Sort by similarity score first, then by view count
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        return b.viewCount - a.viewCount;
      });

    return scoredVideos.slice(0, limit).map(v => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      qualityScore: v.qualityScore,
      similarityScore: v.similarityScore,
      matchReason: v.matchReason,
      band: v.band,
      category: v.category,
    }));
  }

  /**
   * Get fallback videos (popular in same category or overall)
   */
  private async getFallbackVideos(
    categoryId: string | null,
    excludeBandId: string,
    limit: number,
    excludeVideoIds: Set<string>,
    excludeWatchedIds: Set<string>,
  ): Promise<RelatedVideo[]> {
    const allExcluded = new Set([...excludeVideoIds, ...excludeWatchedIds]);

    const fallbackVideos = await this.readReplica.executeRead((client) =>
      client.video.findMany({
        where: {
          isHidden: false,
          id: { notIn: Array.from(allExcluded) },
          ...(categoryId && { categoryId }),
          bandId: { not: excludeBandId },
        },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          publishedAt: true,
          viewCount: true,
          likeCount: true,
          qualityScore: true,
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [
          { viewCount: 'desc' },
          { qualityScore: 'desc' },
        ],
        take: limit,
      }),
    );

    return fallbackVideos.map(v => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      qualityScore: v.qualityScore,
      similarityScore: 0,
      matchReason: categoryId ? 'Popular in this category' : 'Popular video',
      band: v.band,
      category: v.category,
    }));
  }

  /**
   * Get "Because you watched" sections based on user's watch history
   * Implements collaborative filtering
   */
  private async getBecauseYouWatchedSections(
    userId: string,
    currentVideoId: string,
    maxSections: number,
    videosPerSection: number,
    watchedVideoIds: Set<string>,
  ): Promise<BecauseYouWatchedSection[]> {
    // Get user's recent watch history
    const recentWatches = await this.readReplica.executeRead((client) =>
      client.watchHistory.findMany({
        where: {
          userId,
          videoId: { not: currentVideoId },
        },
        orderBy: { watchedAt: 'desc' },
        take: 20,
        include: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              bandId: true,
              categoryId: true,
              eventName: true,
              tags: true,
            },
          },
        },
      }),
    );

    if (recentWatches.length === 0) {
      return [];
    }

    // Get unique videos from watch history
    const uniqueWatched = new Map<string, typeof recentWatches[0]['video']>();
    for (const watch of recentWatches) {
      if (!uniqueWatched.has(watch.video.id)) {
        uniqueWatched.set(watch.video.id, watch.video);
      }
    }

    const sections: BecauseYouWatchedSection[] = [];
    const usedVideoIds = new Set<string>([currentVideoId, ...watchedVideoIds]);

    // Create sections for top watched videos
    for (const [, sourceVideo] of uniqueWatched) {
      if (sections.length >= maxSections) break;

      // Find related videos for this watched video
      const relatedVideos = await this.readReplica.executeRead((client) =>
        client.video.findMany({
          where: {
            isHidden: false,
            id: { notIn: Array.from(usedVideoIds) },
            OR: [
              { bandId: sourceVideo.bandId },
              ...(sourceVideo.categoryId ? [{ categoryId: sourceVideo.categoryId }] : []),
            ],
          },
          select: {
            id: true,
            youtubeId: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            publishedAt: true,
            viewCount: true,
            likeCount: true,
            qualityScore: true,
            bandId: true,
            categoryId: true,
            band: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: { viewCount: 'desc' },
          take: videosPerSection,
        }),
      );

      if (relatedVideos.length > 0) {
        // Add to used IDs to prevent duplicates across sections
        relatedVideos.forEach(v => usedVideoIds.add(v.id));

        sections.push({
          sourceVideo: {
            id: sourceVideo.id,
            title: sourceVideo.title,
            thumbnailUrl: sourceVideo.thumbnailUrl,
          },
          videos: relatedVideos.map(v => ({
            id: v.id,
            youtubeId: v.youtubeId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            duration: v.duration,
            publishedAt: v.publishedAt,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            qualityScore: v.qualityScore,
            similarityScore: v.bandId === sourceVideo.bandId ? 40 : 30,
            matchReason: v.bandId === sourceVideo.bandId ? 'Same band' : 'Same category',
            band: v.band,
            category: v.category,
          })),
        });
      }
    }

    return sections;
  }

  /**
   * Get watched video IDs for a user
   */
  private async getWatchedVideoIds(userId: string): Promise<Set<string>> {
    const watchHistory = await this.readReplica.executeRead((client) =>
      client.watchHistory.findMany({
        where: { userId },
        select: { videoId: true },
      }),
    );

    return new Set(watchHistory.map(w => w.videoId));
  }

  /**
   * Get video by ID for scoring
   */
  private async getVideoById(videoId: string): Promise<VideoForScoring | null> {
    return this.readReplica.executeRead((client) =>
      client.video.findUnique({
        where: { id: videoId },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          publishedAt: true,
          viewCount: true,
          likeCount: true,
          qualityScore: true,
          bandId: true,
          categoryId: true,
          eventName: true,
          eventYear: true,
          tags: true,
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
    );
  }

  /**
   * Build cache key for related videos
   */
  private buildCacheKey(videoId: string, limit: number, userId?: string): string {
    const parts = [this.CACHE_KEY_PREFIX, videoId, `limit:${limit}`];
    if (userId) {
      parts.push(`user:${userId}`);
    }
    return parts.join(':');
  }

  /**
   * Invalidate related videos cache for a specific video
   */
  async invalidateRelatedVideosCache(videoId: string): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}${videoId}:*`;
    await this.cache.delPattern(pattern);
    this.logger.debug(`Invalidated related videos cache for video: ${videoId}`);
  }

  /**
   * Invalidate all related videos caches
   */
  async invalidateAllRelatedVideosCache(): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}*`;
    await this.cache.delPattern(pattern);
    this.logger.log('All related videos caches invalidated');
  }
}
