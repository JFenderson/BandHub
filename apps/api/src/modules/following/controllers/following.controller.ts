import {
  Controller,
  Get,
  Post,
  Delete,
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
import { FollowingService } from '../services/following.service';
import { GetFollowersQueryDto } from '../dto';
import { UserAuthGuard } from '../../users/guards/user-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitType } from '../../../common/interfaces/rate-limit.interface';

@ApiTags('Following')
@Controller('users')
@RateLimit({
  limit: 100,
  windowMs: 60 * 60 * 1000,
  type: RateLimitType.IP,
  message: 'Too many follow requests. Please try again later.',
})
export class FollowingController {
  constructor(private readonly followingService: FollowingService) {}

  @Post(':id/follow')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 201, description: 'Successfully followed user' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Already following this user' })
  @RateLimit({
    limit: 50,
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.USER,
    message: 'Too many follow attempts. Please try again later.',
  })
  async followUser(
    @Param('id') followingId: string,
    @CurrentUser('userId') followerId: string,
  ) {
    return this.followingService.followUser(followerId, followingId);
  }

  @Delete(':id/follow')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 204, description: 'Successfully unfollowed user' })
  @ApiResponse({ status: 400, description: 'Cannot unfollow yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  async unfollowUser(
    @Param('id') followingId: string,
    @CurrentUser('userId') followerId: string,
  ) {
    return this.followingService.unfollowUser(followerId, followingId);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get user followers with pagination' })
  @ApiResponse({ status: 200, description: 'Followers retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getFollowers(
    @Param('id') userId: string,
    @Query() query: GetFollowersQueryDto,
  ) {
    return this.followingService.getFollowers(userId, query);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get users that user is following with pagination' })
  @ApiResponse({ status: 200, description: 'Following retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getFollowing(
    @Param('id') userId: string,
    @Query() query: GetFollowersQueryDto,
  ) {
    return this.followingService.getFollowing(userId, query);
  }

  @Get(':id/follow-status')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user follows specified user' })
  @ApiResponse({ status: 200, description: 'Follow status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFollowStatus(
    @Param('id') followingId: string,
    @CurrentUser('userId') followerId: string,
  ) {
    return this.followingService.isFollowing(followerId, followingId);
  }

  @Get(':id/follow-counts')
  @ApiOperation({ summary: 'Get follower and following counts for a user' })
  @ApiResponse({ status: 200, description: 'Counts retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getFollowCounts(@Param('id') userId: string) {
    return this.followingService.getFollowCounts(userId);
  }
}
