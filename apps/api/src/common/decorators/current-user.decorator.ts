import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Interface for the authenticated user object attached to requests
 */
export interface CurrentUserData {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * Decorator to extract the current authenticated user from the request.
 * The user object is populated by JwtAuthGuard after successful authentication.
 * 
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@CurrentUser() user: CurrentUserData) {
 *   return { user };
 * }
 * 
 * @example
 * // Extract only the userId
 * @Post('videos/:id/like')
 * @UseGuards(JwtAuthGuard)
 * async likeVideo(
 *   @Param('id') id: string,
 *   @CurrentUser('userId') userId: string,
 * ) {
 *   return this.videosService.likeVideo(id, userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext): CurrentUserData | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property is requested, return just that
    if (data) {
      return user?.[data];
    }

    // Otherwise return the full user object
    return user;
  },
);