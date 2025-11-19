import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API health status' })
  async check() {
    const checks = {
      api: 'ok',
      database: 'ok',
      cache: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      checks.database = 'error';
    }

    // Check cache
    try {
      await this.cache.set('health-check', 'ok', 10);
      const value = await this.cache.get('health-check');
      if (value !== 'ok') {
        checks.cache = 'error';
      }
    } catch (error) {
      checks.cache = 'error';
    }

    return checks;
  }
}