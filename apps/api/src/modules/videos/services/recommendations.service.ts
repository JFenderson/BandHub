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
 * Similarity Score Formula (prioritizes discovering different bands):
 * - Same Category: 40%
 * - Same Event/Year: 30%
 * - Matching Tags: 20%
 * - Quality Bonus: 10%
 *
 * Same-band videos are EXCLUDED by default to encourage discovery
 */
@Injectable()
export class VideoRecommendationsService {
  private readonly logger = new Logger(VideoRecommendationsService.name);

  private readonly CACHE_TTL = {
    RELATED_VIDEOS: 21600, // 6 hours
    BECAUSE_YOU_WATCHED: 21600, // 6 hours
  };

  private readonly CACHE_KEY_PREFIX = 'videos:related:';

  // Weights for similarity calculation (excludes same band)
  private readonly SIMILARITY_WEIGHTS = {
    sameCategory: 0.4,
    sameEvent: 0.3,
    matchingTags: 0.2,
    qualityBonus: 0.1,
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
   * Prioritizes content similarity (category, event, tags) over same-band
   * Same-band videos should be excluded before calling this method
   */
  private calculateSimilarityScore(
    sourceVideo: VideoForScoring,
    candidateVideo: VideoForScoring,
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Same category (40%) - highest weight for content similarity
    if (
      sourceVideo.categoryId &&
      candidateVideo.categoryId &&
      sourceVideo.categoryId === candidateVideo.categoryId
    ) {
      score += this.SIMILARITY_WEIGHTS.sameCategory * 100;
      reasons.push('Similar style');
    }

    // Same event or year (30%)
    const exactEventMatch =
      sourceVideo.eventName &&
      candidateVideo.eventName &&
      sourceVideo.eventName.toLowerCase() === candidateVideo.eventName.toLowerCase();

    const sameYear =
      sourceVideo.eventYear &&
      candidateVideo.eventYear &&
      sourceVideo.eventYear === candidateVideo.eventYear;

    if (exactEventMatch) {
      score += this.SIMILARITY_WEIGHTS.sameEvent * 100;
      reasons.push('Same event');
    } else if (sameYear) {
      score += this.SIMILARITY_WEIGHTS.sameEvent * 70; // Partial credit for same year
      reasons.push('Same year');
    }

    // Matching tags (20%)
    if (sourceVideo.tags.length > 0 && candidateVideo.tags.length > 0) {
      const sourceTags = new Set(sourceVideo.tags.map(t => t.toLowerCase()));
      const matchingTags = candidateVideo.tags.filter(t =>
        sourceTags.has(t.toLowerCase()),
      );

      if (matchingTags.length > 0) {
        const tagMatchRatio = matchingTags.length / sourceVideo.tags.length;
        score += this.SIMILARITY_WEIGHTS.matchingTags * 100 * Math.min(1, tagMatchRatio);
        reasons.push(`${matchingTags.length} matching tags`);
      }
    }

    // Quality bonus (10%) - reward high quality videos
    if (candidateVideo.qualityScore >= 7) {
      score += this.SIMILARITY_WEIGHTS.qualityBonus * 100;
      reasons.push('High quality');
    } else if (candidateVideo.qualityScore >= 5) {
      score += this.SIMILARITY_WEIGHTS.qualityBonus * 50;
    }

    return {
      score: Math.round(score * 100) / 100,
      reason: reasons.length > 0 ? reasons.join(', ') : 'Discover new bands',
    };
  }

  /**
   * Calculate related videos using content-based filtering
   * EXCLUDES same-band videos to encourage discovery of new bands
   */
  private async calculateRelatedVideos(
    sourceVideo: VideoForScoring,
    limit: number,
    excludeVideoIds: Set<string>,
  ): Promise<RelatedVideo[]> {
    // Build OR conditions for finding similar content from DIFFERENT bands
    const orConditions: any[] = [];

    // Same category (different band)
    if (sourceVideo.categoryId) {
      orConditions.push({ categoryId: sourceVideo.categoryId });
    }

    // Same event name (different band)
    if (sourceVideo.eventName) {
      orConditions.push({
        eventName: { contains: sourceVideo.eventName, mode: 'insensitive' as const },
      });
    }

    // Same event year (different band)
    if (sourceVideo.eventYear) {
      orConditions.push({ eventYear: sourceVideo.eventYear });
    }

    // Matching tags (different band)
    if (sourceVideo.tags.length > 0) {
      orConditions.push({ tags: { hasSome: sourceVideo.tags } });
    }

    // If no matching criteria, fall back to any popular video from different band
    if (orConditions.length === 0) {
      orConditions.push({ isHidden: false }); // Match any visible video
    }

    // Fetch candidate videos from DIFFERENT bands with similar content
    const candidates = await this.readReplica.executeRead((client) =>
      client.video.findMany({
        where: {
          isHidden: false,
          id: { not: sourceVideo.id },
          bandId: { not: sourceVideo.bandId }, // EXCLUDE same band
          OR: orConditions,
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
          { qualityScore: 'desc' },
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
      .sort((a, b) => {
        // Sort by similarity score first, then by view count
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        return b.viewCount - a.viewCount;
      });

    // Diversify results - avoid too many videos from same band
    const diversifiedVideos = this.diversifyByBand(scoredVideos, limit);

    return diversifiedVideos.map(v => ({
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
   * Diversify results to avoid too many videos from the same band
   * Limits to max 2 videos per band in the results
   */
  private diversifyByBand<T extends { bandId: string }>(
    videos: T[],
    limit: number,
    maxPerBand: number = 2,
  ): T[] {
    const result: T[] = [];
    const bandCounts = new Map<string, number>();

    for (const video of videos) {
      if (result.length >= limit) break;

      const currentCount = bandCounts.get(video.bandId) || 0;
      if (currentCount < maxPerBand) {
        result.push(video);
        bandCounts.set(video.bandId, currentCount + 1);
      }
    }

    return result;
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
   * Implements collaborative filtering - finds similar content from DIFFERENT bands
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
              eventYear: true,
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
    const usedBandIds = new Set<string>(); // Track bands already shown in sections

    // Create sections for top watched videos - find similar content from DIFFERENT bands
    for (const [, sourceVideo] of uniqueWatched) {
      if (sections.length >= maxSections) break;

      // Build OR conditions for similar content
      const orConditions: any[] = [];
      if (sourceVideo.categoryId) {
        orConditions.push({ categoryId: sourceVideo.categoryId });
      }
      if (sourceVideo.eventName) {
        orConditions.push({
          eventName: { contains: sourceVideo.eventName, mode: 'insensitive' as const },
        });
      }
      if (sourceVideo.tags && sourceVideo.tags.length > 0) {
        orConditions.push({ tags: { hasSome: sourceVideo.tags } });
      }

      if (orConditions.length === 0) continue;

      // Find related videos from DIFFERENT bands
      const relatedVideos = await this.readReplica.executeRead((client) =>
        client.video.findMany({
          where: {
            isHidden: false,
            id: { notIn: Array.from(usedVideoIds) },
            bandId: { not: sourceVideo.bandId }, // EXCLUDE same band
            OR: orConditions,
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
            { qualityScore: 'desc' },
            { viewCount: 'desc' },
          ],
          take: videosPerSection * 3, // Fetch more for diversification
        }),
      );

      // Diversify to avoid same band repeating
      const diversified = this.diversifyByBand(
        relatedVideos.filter(v => !usedBandIds.has(v.bandId)),
        videosPerSection,
        1, // Only 1 video per band in "Because you watched" sections
      );

      if (diversified.length > 0) {
        // Add to used IDs to prevent duplicates across sections
        diversified.forEach(v => {
          usedVideoIds.add(v.id);
          usedBandIds.add(v.bandId);
        });

        sections.push({
          sourceVideo: {
            id: sourceVideo.id,
            title: sourceVideo.title,
            thumbnailUrl: sourceVideo.thumbnailUrl,
          },
          videos: diversified.map(v => {
            // Determine match reason
            let matchReason = 'Discover new band';
            if (sourceVideo.categoryId && v.categoryId === sourceVideo.categoryId) {
              matchReason = 'Similar style';
            } else if (sourceVideo.eventName && v.eventName?.toLowerCase().includes(sourceVideo.eventName.toLowerCase())) {
              matchReason = 'Same event';
            }

            return {
              id: v.id,
              youtubeId: v.youtubeId,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              duration: v.duration,
              publishedAt: v.publishedAt,
              viewCount: v.viewCount,
              likeCount: v.likeCount,
              qualityScore: v.qualityScore,
              similarityScore: 40,
              matchReason,
              band: v.band,
              category: v.category,
            };
          }),
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
