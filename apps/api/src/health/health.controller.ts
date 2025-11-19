import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API health status' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async checkHealth() {
    const timestamp = new Date().toISOString();
    
    try {
      // Test database connection
      await this.db.$queryRaw`SELECT 1 as test`;
      
      // Test cache connection
      await this.cacheService.set('health-check', timestamp, 10);
      const cacheTest = await this.cacheService.get('health-check');
      
      return {
        api: 'ok',
        database: 'ok',
        cache: cacheTest === timestamp ? 'ok' : 'error',
        timestamp,
      };
    } catch (error) {
      return {
        api: 'ok',
        database: 'error',
        cache: 'unknown',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('database')
  @ApiOperation({ summary: 'Check database connection' })
  @ApiResponse({ status: 200, description: 'Database check' })
  async checkDatabase() {
    try {
      await this.db.$queryRaw`SELECT 1 as test`;
      return {
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('cache')
  @ApiOperation({ summary: 'Check cache connection' })
  @ApiResponse({ status: 200, description: 'Cache check' })
  async checkCache() {
    try {
      const testKey = 'cache-health-test';
      const testValue = new Date().toISOString();
      
      await this.cacheService.set(testKey, testValue, 5);
      const retrieved = await this.cacheService.get(testKey);
      
      return {
        cache: retrieved === testValue ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        cache: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}