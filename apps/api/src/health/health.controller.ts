import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API health status (summary)' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async checkHealth() {
    // Keep a simple summary for backward compatibility
    const ready = await this.healthService.readiness();
    return { api: 'ok', readiness: ready };
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
}