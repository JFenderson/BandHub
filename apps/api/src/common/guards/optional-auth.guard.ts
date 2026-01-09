import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalAuthGuard allows requests to proceed with or without authentication.
 * 
 * Unlike JwtAuthGuard which rejects unauthenticated requests, this guard:
 * - Validates JWT if present
 * - Attaches user to request if valid
 * - Allows request to continue even if no JWT or invalid JWT
 * 
 * Use this for endpoints that:
 * - Are public but offer personalized features for logged-in users
 * - Need to differentiate between authenticated and anonymous users
 * 
 * @example
 * @UseGuards(OptionalAuthGuard)
 * @Get('trending')
 * async getTrending(@CurrentUser() user?: User) {
 *   // user will be populated if authenticated, undefined if not
 * }
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  /**
   * Always return true to allow the request through
   */
  canActivate(context: ExecutionContext) {
    // Call parent canActivate but catch any errors
    return super.canActivate(context);
  }

  /**
   * Handle the JWT validation result
   * Unlike regular AuthGuard, we don't throw on auth failure
   */
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser | null {
    // If there's an error or no user, just return null instead of throwing
    // The request will continue but without a user attached
    if (err || !user) {
      return null;
    }
    
    return user;
  }
}