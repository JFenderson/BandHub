import {
  Controller,
  Get,
  Post,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { AchievementTrackerService } from './achievement-tracker.service';
import { LeaderboardService } from './leaderboard.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { OptionalUserAuthGuard } from '../users/guards/optional-user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import {
  GetAchievementsQueryDto,
  GetLeaderboardQueryDto,
  AchievementResponseDto,
  UserPointsResponseDto,
  UserBadgesResponseDto,
  PerksResponseDto,
  LeaderboardResponseDto,
} from './dto/achievement.dto';
import { AchievementCategory } from './achievement-definitions';

@ApiTags('achievements')
@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly trackerService: AchievementTrackerService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  // ============ PUBLIC ENDPOINTS ============

  @Get()
  @UseGuards(OptionalUserAuthGuard)
  @ApiOperation({ summary: 'Get all achievements' })
  @ApiResponse({ status: 200, description: 'List of achievements' })
  async getAchievements(
    @Query() query: GetAchievementsQueryDto,
    @CurrentUser() user?: CurrentUserData,
  ) {
    return this.achievementsService.getAchievements(user?.userId || null, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get achievement statistics' })
  @ApiResponse({ status: 200, description: 'Achievement statistics' })
  async getStats() {
    return this.achievementsService.getAchievementStats();
  }

  @Get('leaderboard')
  @UseGuards(OptionalUserAuthGuard)
  @ApiOperation({ summary: 'Get the leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard data' })
  async getLeaderboard(
    @Query() query: GetLeaderboardQueryDto,
    @CurrentUser() user?: CurrentUserData,
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getLeaderboard(query, user?.userId);
  }

  @Get('leaderboard/top-collectors')
  @ApiOperation({ summary: 'Get top collectors of rare achievements' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Top collectors' })
  async getTopCollectors(@Query('limit') limit?: number) {
    return this.leaderboardService.getTopCollectors(limit || 10);
  }

  @Get('leaderboard/category/:category')
  @ApiOperation({ summary: 'Get leaderboard for a specific category' })
  @ApiParam({ name: 'category', enum: AchievementCategory })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Category leaderboard' })
  async getCategoryLeaderboard(
    @Param('category') category: string,
    @Query('limit') limit?: number,
  ) {
    return this.leaderboardService.getCategoryLeaderboard(category, limit || 10);
  }

  @Get(':idOrSlug')
  @UseGuards(OptionalUserAuthGuard)
  @ApiOperation({ summary: 'Get a single achievement' })
  @ApiParam({ name: 'idOrSlug', description: 'Achievement ID or slug' })
  @ApiResponse({ status: 200, description: 'Achievement details' })
  @ApiResponse({ status: 404, description: 'Achievement not found' })
  async getAchievement(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user?: CurrentUserData,
  ): Promise<AchievementResponseDto> {
    return this.achievementsService.getAchievement(idOrSlug, user?.userId || null);
  }

  // ============ AUTHENTICATED ENDPOINTS ============

  @Get('me/achievements')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user achievements' })
  @ApiResponse({ status: 200, description: 'User achievements' })
  async getMyAchievements(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetAchievementsQueryDto,
  ) {
    return this.achievementsService.getUserAchievements(user.userId, query);
  }

  @Get('me/points')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user points and level' })
  @ApiResponse({ status: 200, description: 'User points and level' })
  async getMyPoints(@CurrentUser() user: CurrentUserData): Promise<UserPointsResponseDto> {
    return this.achievementsService.getUserPoints(user.userId);
  }

  @Get('me/badges')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user badges for profile display' })
  @ApiResponse({ status: 200, description: 'User badges' })
  async getMyBadges(@CurrentUser() user: CurrentUserData): Promise<UserBadgesResponseDto> {
    return this.achievementsService.getUserBadges(user.userId);
  }

  @Get('me/perks')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user perks based on level' })
  @ApiResponse({ status: 200, description: 'User perks' })
  async getMyPerks(@CurrentUser() user: CurrentUserData): Promise<PerksResponseDto> {
    return this.achievementsService.getUserPerks(user.userId);
  }

  @Get('me/rank')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user leaderboard rank' })
  @ApiResponse({ status: 200, description: 'User rank' })
  async getMyRank(@CurrentUser() user: CurrentUserData) {
    const rank = await this.leaderboardService.getUserRank(user.userId);
    return { rank };
  }

  @Post('me/recalculate')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recalculate all achievements for current user' })
  @ApiResponse({ status: 200, description: 'Achievements recalculated' })
  async recalculateMyAchievements(@CurrentUser() user: CurrentUserData) {
    await this.trackerService.recalculateUserAchievements(user.userId);
    return { message: 'Achievements recalculated successfully' };
  }

  // ============ USER PROFILE ENDPOINTS ============

  @Get('user/:userId/badges')
  @ApiOperation({ summary: 'Get badges for a user profile' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User badges' })
  async getUserBadges(@Param('userId') userId: string): Promise<UserBadgesResponseDto> {
    return this.achievementsService.getUserBadges(userId);
  }

  @Get('user/:userId/points')
  @ApiOperation({ summary: 'Get points for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User points' })
  async getUserPoints(@Param('userId') userId: string): Promise<UserPointsResponseDto> {
    return this.achievementsService.getUserPoints(userId);
  }
}
