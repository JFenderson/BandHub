import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { Prisma } from '@prisma/client';

// Configuration constants for the recommendation algorithm
const RECOMMENDATION_CONFIG = {
  // Time periods in days
  RECENT_ACTIVITY_DAYS: 30,
  RECENT_SYNC_DAYS: 7,
  // Scoring weights (should sum to 1.0)
  ACTIVITY_WEIGHT: 0.4,
  POPULARITY_WEIGHT: 0.3,
  DIVERSITY_WEIGHT: 0.2,
  RECENCY_WEIGHT: 0.1,
  // Thresholds
  HIGH_ENGAGEMENT_VIEWS: 10000,
};

interface RecommendationScore {
  activityScore: number;
  popularityScore: number;
  diversityScore: number;
  recencyPenalty: number;
  totalScore: number;
}

// Define the type for band with stats from the query
type BandWithStats = Prisma.BandGetPayload<{
  include: {
    _count: {
      select: {
        videos: true;
      };
    };
    videos: {
      select: {
        id: true;
        viewCount: true;
      };
    };
  };
}>;

export interface FeaturedRecommendation {
  band: {
    id: string;
    name: string;
    school: string;
    conference: string | null;
    logoUrl: string | null;
    description: string | null;
    slug: string;
    videoCount: number;
  };
  score: number;
  reasoning: string[];
  suggestedAction?: string;
}

@Injectable()
export class FeaturedRecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(limit: number = 5): Promise<FeaturedRecommendation[]> {
    // Get all active bands with their stats
    const bands = await this.prisma.band.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            videos: {
              where: { isHidden: false },
            },
          },
        },
        videos: {
          where: {
            isHidden: false,
            publishedAt: {
              gte: new Date(Date.now() - RECOMMENDATION_CONFIG.RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000),
            },
          },
          select: {
            id: true,
            viewCount: true,
          },
        },
      },
    });

    // Get current featured bands and their conferences
    const featuredBands = await this.prisma.band.findMany({
      where: { isFeatured: true },
      select: { id: true, conference: true },
    });

    const featuredConferences = new Set(
      featuredBands.map(b => b.conference).filter((c): c is string => c !== null),
    );

    // Get lowest performing featured band for replacement suggestions
    const lowestPerformingFeatured = await this.getLowestPerformingFeaturedBand();

    // Calculate scores for each non-featured band
    const scoredBands = bands
      .filter(band => !band.isFeatured)
      .map(band => {
        const scores = this.calculateScores(band, featuredConferences);
        const reasoning = this.generateReasoning(band, scores, featuredConferences);
        
        return {
          band: {
            id: band.id,
            name: band.name,
            school: band.schoolName,
            conference: band.conference,
            logoUrl: band.logoUrl,
            description: band.description,
            slug: band.slug,
            videoCount: band._count.videos,
          },
          score: scores.totalScore,
          reasoning,
          suggestedAction: lowestPerformingFeatured
            ? `Replace "${lowestPerformingFeatured.name}"`
            : undefined,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredBands;
  }

  private calculateScores(
    band: BandWithStats,
    featuredConferences: Set<string>,
  ): RecommendationScore {
    // Activity Score
    const recentVideosCount = band.videos.length;
    const lastSyncRecent = band.lastSyncAt
      ? (Date.now() - new Date(band.lastSyncAt).getTime()) < RECOMMENDATION_CONFIG.RECENT_SYNC_DAYS * 24 * 60 * 60 * 1000
      : false;
    const activityScore = Math.min(
      (recentVideosCount * 10) + (lastSyncRecent ? 20 : 0),
      100,
    ) * RECOMMENDATION_CONFIG.ACTIVITY_WEIGHT;

    // Popularity Score
    const totalVideos = band._count.videos;
    const totalViews = band.videos.reduce((sum, v) => sum + v.viewCount, 0);
    const avgViews = totalVideos > 0 ? totalViews / totalVideos : 0;
    const popularityScore = Math.min(
      (totalVideos * 2) + (avgViews / 1000),
      100,
    ) * RECOMMENDATION_CONFIG.POPULARITY_WEIGHT;

    // Diversity Score
    const isUnderrepresentedConference = band.conference
      ? !featuredConferences.has(band.conference)
      : true;
    const diversityScore = isUnderrepresentedConference 
      ? 100 * RECOMMENDATION_CONFIG.DIVERSITY_WEIGHT 
      : 50 * RECOMMENDATION_CONFIG.DIVERSITY_WEIGHT;

    // Recency Penalty - Bonus for never featured
    const neverFeatured = !band.featuredSince;
    const recencyPenalty = neverFeatured ? 100 * RECOMMENDATION_CONFIG.RECENCY_WEIGHT : 0;

    return {
      activityScore,
      popularityScore,
      diversityScore,
      recencyPenalty,
      totalScore: activityScore + popularityScore + diversityScore + recencyPenalty,
    };
  }

  private generateReasoning(
    band: BandWithStats,
    scores: RecommendationScore,
    featuredConferences: Set<string>,
  ): string[] {
    const reasoning: string[] = [];

    // Activity reasons
    const recentVideosCount = band.videos.length;
    if (recentVideosCount > 0) {
      reasoning.push(`Added ${recentVideosCount} new videos this month`);
    }

    // Popularity reasons
    if (band._count.videos >= 10) {
      reasoning.push(`Has ${band._count.videos} videos in database`);
    }

    // Diversity reasons
    if (band.conference && !featuredConferences.has(band.conference)) {
      reasoning.push(`Represents ${band.conference} conference (underrepresented)`);
    }

    // Recency reasons
    if (!band.featuredSince) {
      reasoning.push('Never been featured before');
    }

    // Sync status
    if (band.lastSyncAt) {
      const daysSinceSync = Math.floor(
        (Date.now() - new Date(band.lastSyncAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysSinceSync < RECOMMENDATION_CONFIG.RECENT_SYNC_DAYS) {
        reasoning.push('Recently synced (active channel)');
      }
    }

    // Video engagement
    const totalViews = band.videos.reduce((sum, v) => sum + v.viewCount, 0);
    if (totalViews > RECOMMENDATION_CONFIG.HIGH_ENGAGEMENT_VIEWS) {
      reasoning.push('High engagement rate');
    }

    return reasoning.length > 0 ? reasoning : ['Potential new featured band'];
  }

  private async getLowestPerformingFeaturedBand(): Promise<{ id: string; name: string } | null> {
    const featuredBands = await this.prisma.band.findMany({
      where: { isFeatured: true },
      include: {
        _count: {
          select: {
            featuredClicks: true,
          },
        },
      },
      orderBy: {
        featuredClicks: {
          _count: 'asc',
        },
      },
      take: 1,
    });

    return featuredBands.length > 0
      ? { id: featuredBands[0].id, name: featuredBands[0].name }
      : null;
  }
}
