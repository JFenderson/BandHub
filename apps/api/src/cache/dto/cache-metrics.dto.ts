import { ApiProperty } from '@nestjs/swagger';

/**
 * Statistics for a single cache key or namespace
 */
export class CacheStats {
  @ApiProperty({ 
    description: 'Cache key or namespace',
    example: 'bands'
  })
  key: string;

  @ApiProperty({ 
    description: 'Number of cache hits',
    example: 1250
  })
  hits: number;

  @ApiProperty({ 
    description: 'Number of cache misses',
    example: 150
  })
  misses: number;

  @ApiProperty({ 
    description: 'Hit rate (0-1)',
    example: 0.893,
    minimum: 0,
    maximum: 1
  })
  hitRate: number;
}

/**
 * Overall cache metrics for monitoring
 */
export class CacheMetricsDto {
  @ApiProperty({ 
    description: 'Total cache hits across all keys',
    example: 5420
  })
  hits: number;

  @ApiProperty({ 
    description: 'Total cache misses across all keys',
    example: 680
  })
  misses: number;

  @ApiProperty({ 
    description: 'Overall hit rate (0-1)',
    example: 0.889,
    minimum: 0,
    maximum: 1
  })
  hitRate: number;

  @ApiProperty({ 
    description: 'Total requests (hits + misses)',
    example: 6100
  })
  totalRequests: number;

  @ApiProperty({ 
    description: 'Redis memory usage in bytes',
    example: 15728640
  })
  usedMemoryBytes: number;

  @ApiProperty({ 
    description: 'Redis memory usage in MB',
    example: 15
  })
  usedMemoryMB: number;

  @ApiProperty({ 
    description: 'Top 10 most accessed cache namespaces',
    type: [CacheStats]
  })
  topKeys: CacheStats[];
}

/**
 * Detailed cache health information
 */
export class CacheHealthDto {
  @ApiProperty({ 
    description: 'Whether cache is operational',
    example: true
  })
  healthy: boolean;

  @ApiProperty({ 
    description: 'Redis connection status',
    example: 'connected'
  })
  status: string;

  @ApiProperty({ 
    description: 'Response time in milliseconds',
    example: 2
  })
  responseTimeMs: number;

  @ApiProperty({ 
    description: 'Memory usage information',
    required: false
  })
  memory?: {
    used: string;
    peak: string;
    fragmentationRatio: string;
  };
}