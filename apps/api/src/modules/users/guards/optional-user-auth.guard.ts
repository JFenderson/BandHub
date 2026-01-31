import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalUserAuthGuard - Allows requests with or without authentication
 * If a valid token is provided, the user is extracted
 * If no token or invalid token, the request continues without user context
 */
@Injectable()
export class OptionalUserAuthGuard extends AuthGuard('user-jwt') {
  canActivate(context: ExecutionContext) {
    // Call the parent canActivate, which will validate the token if present
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    // Don't throw an error if authentication fails
    // Just return null/undefined for user
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }
}
