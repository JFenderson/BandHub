import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Clean up expired refresh tokens daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTokenCleanup() {
    this.logger.log('Starting cleanup of expired refresh tokens...');
    
    try {
      const deletedCount = await this.authService.cleanupExpiredTokens();
      this.logger.log(`Cleaned up ${deletedCount} expired refresh tokens`);
    } catch (error) {
      this.logger.error('Failed to clean up expired tokens', error);
    }
  }
}