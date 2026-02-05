import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { CreateReviewDto, UpdateReviewDto, GetReviewsQueryDto } from '../dto';
import { AchievementTrackerService } from '../../achievements/achievement-tracker.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  async create(bandId: string, userId: string, dto: CreateReviewDto) {
    // Verify band exists
    const band = await this.prisma.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      throw new NotFoundException('Band not found');
    }

    // Check if user already reviewed this band
    const existingReview = await this.prisma.review.findUnique({
      where: {
        bandId_userId: {
          bandId,
          userId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this band');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        bandId,
        userId,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Track achievement progress
    this.achievementTracker.trackReviewPosted(userId).catch(() => {});

    return review;
  }

  async findByBand(bandId: string, query: GetReviewsQueryDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', rating } = query;
    const skip = (page - 1) * limit;

    // Build filter
    const where: any = { bandId };
    if (rating) {
      where.rating = rating;
    }

    // Execute query with pagination
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    // Find review and verify ownership
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    // Update review
    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return updatedReview;
  }

  async remove(reviewId: string, userId: string) {
    // Find review and verify ownership
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    // Delete review
    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    return { message: 'Review deleted successfully' };
  }

  async voteHelpful(reviewId: string, userId: string, isHelpful: boolean) {
    // Verify review exists
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Prevent voting on own review
    if (review.userId === userId) {
      throw new BadRequestException('You cannot vote on your own review');
    }

    // Check if user already voted
    const existingVote = await this.prisma.reviewVote.findUnique({
      where: {
        reviewId_userId: {
          reviewId,
          userId,
        },
      },
    });

    // Handle vote logic
    if (existingVote) {
      // Update vote if different
      if (existingVote.isHelpful !== isHelpful) {
        await this.prisma.$transaction(async (tx) => {
          // Update vote
          await tx.reviewVote.update({
            where: { id: existingVote.id },
            data: { isHelpful },
          });

          // Update review counters
          if (isHelpful) {
            await tx.review.update({
              where: { id: reviewId },
              data: {
                helpful: { increment: 1 },
                notHelpful: { decrement: 1 },
              },
            });
          } else {
            await tx.review.update({
              where: { id: reviewId },
              data: {
                helpful: { decrement: 1 },
                notHelpful: { increment: 1 },
              },
            });
          }
        });
      }
    } else {
      // Create new vote
      await this.prisma.$transaction(async (tx) => {
        await tx.reviewVote.create({
          data: {
            reviewId,
            userId,
            isHelpful,
          },
        });

        // Update review counter
        await tx.review.update({
          where: { id: reviewId },
          data: isHelpful
            ? { helpful: { increment: 1 } }
            : { notHelpful: { increment: 1 } },
        });
      });
    }

    // Return updated review
    return this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  async removeVote(reviewId: string, userId: string) {
    // Find vote
    const vote = await this.prisma.reviewVote.findUnique({
      where: {
        reviewId_userId: {
          reviewId,
          userId,
        },
      },
    });

    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    // Remove vote and update counter
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewVote.delete({
        where: { id: vote.id },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: vote.isHelpful
          ? { helpful: { decrement: 1 } }
          : { notHelpful: { decrement: 1 } },
      });
    });

    return { message: 'Vote removed successfully' };
  }

  async getStats(bandId: string) {
    // Verify band exists
    const band = await this.prisma.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      throw new NotFoundException('Band not found');
    }

    // Get all reviews for this band
    const reviews = await this.prisma.review.findMany({
      where: { bandId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      };
    }

    // Calculate stats
    const totalReviews = reviews.length;
    const sumRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = sumRatings / totalReviews;

    // Calculate rating distribution
    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews,
      ratingDistribution,
    };
  }
}
