import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewsService } from '../services/reviews.service';
import { CreateReviewDto, UpdateReviewDto, GetReviewsQueryDto, VoteReviewDto } from '../dto';
import { UserAuthGuard } from '../../users/guards/user-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitType } from '../../../common/interfaces/rate-limit.interface';

@ApiTags('Reviews')
@Controller()
@RateLimit({
  limit: 100,
  windowMs: 60 * 60 * 1000,
  type: RateLimitType.IP,
  message: 'Too many review requests. Please try again later.',
})
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('bands/:bandId/reviews')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a band' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  @ApiResponse({ status: 409, description: 'Review already exists' })
  @RateLimit({
    limit: 10,
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.USER,
    message: 'Too many review creation attempts. Please try again later.',
  })
  async create(
    @Param('bandId') bandId: string,
    @CurrentUser('userId') userId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create(bandId, userId, createReviewDto);
  }

  @Get('bands/:bandId/reviews')
  @ApiOperation({ summary: 'Get reviews for a band with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findByBand(
    @Param('bandId') bandId: string,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.reviewsService.findByBand(bandId, query);
  }

  @Get('bands/:bandId/reviews/stats')
  @ApiOperation({ summary: 'Get review statistics for a band' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async getStats(@Param('bandId') bandId: string) {
    return this.reviewsService.getStats(bandId);
  }

  @Put('reviews/:id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own review' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') reviewId: string,
    @CurrentUser('userId') userId: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(reviewId, userId, updateReviewDto);
  }

  @Delete('reviews/:id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own review' })
  @ApiResponse({ status: 204, description: 'Review deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async remove(
    @Param('id') reviewId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reviewsService.remove(reviewId, userId);
  }

  @Post('reviews/:id/vote')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote on review helpfulness' })
  @ApiResponse({ status: 200, description: 'Vote recorded successfully' })
  @ApiResponse({ status: 400, description: 'Cannot vote on own review' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @RateLimit({
    limit: 50,
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.USER,
    message: 'Too many vote attempts. Please try again later.',
  })
  async voteHelpful(
    @Param('id') reviewId: string,
    @CurrentUser('userId') userId: string,
    @Body() voteDto: VoteReviewDto,
  ) {
    return this.reviewsService.voteHelpful(reviewId, userId, voteDto.isHelpful);
  }

  @Delete('reviews/:id/vote')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove vote from review' })
  @ApiResponse({ status: 204, description: 'Vote removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Vote not found' })
  async removeVote(
    @Param('id') reviewId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reviewsService.removeVote(reviewId, userId);
  }
}
