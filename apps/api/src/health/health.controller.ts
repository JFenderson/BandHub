import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { ConfigService } from '@nestjs/config';
import { SkipRateLimit } from '../common/decorators/rate-limit.decorator';

/**
 * Health Controller
 * 
 * All health check endpoints skip rate limiting to ensure
 * monitoring systems can always check service health.
 */
@ApiTags('health')
@Controller('health')
@SkipRateLimit() // Skip rate limiting for all health endpoints
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API health status (comprehensive)' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async checkHealth() {
    const readinessResult = await this.healthService.readiness();
    const dbCheck = await this.healthService.checkDatabaseDetailed();
    const redisCheck = await this.healthService.checkRedisDetailed();
    
    return {
      status: readinessResult.status === 'ready' ? 'healthy' : 'unhealthy',
      database: dbCheck.status === 'ok' ? 'connected' : 'disconnected',
      redis: redisCheck.status === 'ok' ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      details: readinessResult.details,
    };
  }

  @Get('database')
  @ApiOperation({ summary: 'Detailed database status' })
  async database() {
    return this.healthService.checkDatabaseDetailed();
  }

  @Get('cache')
  @ApiOperation({ summary: 'Detailed cache/redis status' })
  async cache() {
    return this.healthService.checkRedisDetailed();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Detailed BullMQ queue status' })
  async queues() {
    return this.healthService.checkQueuesDetailed();
  }

  @Get('external/youtube')
  @ApiOperation({ summary: 'YouTube API quick check' })
  async youtube() {
    const key = this.configService.get<string>('YOUTUBE_API_KEY');
    return this.healthService.checkYouTubeApi(key);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    return this.healthService.readiness();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  async live() {
    return this.healthService.liveness();
  }

  @Get('test-rate-limit')
async testRateLimit() {
  const { RedisRateLimiterService } = await import('../common/services/redis-rate-limiter.service');
  const { CacheService } = await import('@bandhub/cache');
  
  try {
    const cacheService = new CacheService(null); // might fail but let's see
    const rateLimiter = new RedisRateLimiterService(cacheService);
    
    return {
      status: 'Services can be instantiated',
      redis: await cacheService.getClient().ping(),
    };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error.message,
    };
  }
}
}