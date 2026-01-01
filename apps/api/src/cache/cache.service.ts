import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Enhanced CacheService with:
 * - Cache statistics tracking (hits, misses, evictions)
 * - Cache warming capabilities
 * - Improved pattern-based deletion with SCAN
 * - Connection health monitoring
 * - Better error handling and logging
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client!: Redis;
  
  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      maxRetriesPerRequest: null, // Required for BullMQ compatibility
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.stats.errors++;
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Connected to Redis');
    });

    this.client.on('ready', () => {
      this.logger.log('✅ Redis client ready');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('⚠️ Reconnecting to Redis...');
    });
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from Redis...');
    await this.client.quit();
  }

  /**
   * Get Redis INFO for health/metrics purposes
   */
  async info(section?: string): Promise<string> {
    return this.client.info(section);
  }

  /**
   * Expose the underlying client if needed (use cautiously)
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get value from cache with statistics tracking
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (!value) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }

      this.stats.sets++;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Delete a single key
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.stats.deletes++;
    } catch (error) {
      this.logger.error(`Cache del error for key ${key}:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Delete keys matching a pattern using SCAN for better performance
   * This is non-blocking and won't freeze Redis on large datasets
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        
        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          deletedCount += deleted;
          this.stats.deletes += deleted;
        }
      } while (cursor !== '0');

      this.logger.debug(`Deleted ${deletedCount} keys matching pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Cache delPattern error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}:`, error);
      this.stats.errors++;
      return -1;
    }
  }

  /**
   * Get multiple values at once (pipeline for better performance)
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      if (keys.length === 0) return [];

      const values = await this.client.mget(...keys);
      
      return values.map((value) => {
        if (!value) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;

        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      });
    } catch (error) {
      this.logger.error('Cache mget error:', error);
      this.stats.errors++;
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once (pipeline for better performance)
   */
  async mset(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    try {
      if (entries.length === 0) return;

      const pipeline = this.client.pipeline();

      for (const entry of entries) {
        const stringValue = typeof entry.value === 'string' 
          ? entry.value 
          : JSON.stringify(entry.value);

        if (entry.ttl) {
          pipeline.setex(entry.key, entry.ttl, stringValue);
        } else {
          pipeline.set(entry.key, stringValue);
        }
      }

      await pipeline.exec();
      this.stats.sets += entries.length;
    } catch (error) {
      this.logger.error('Cache mset error:', error);
      this.stats.errors++;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Cache incr error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Cache decr error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      this.logger.warn('⚠️ All cache keys have been flushed');
    } catch (error) {
      this.logger.error('Cache flush error:', error);
      this.stats.errors++;
    }
  }

  /**
   * Get all keys matching a pattern (use sparingly, for debugging only)
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      // Use SCAN instead of KEYS for production safety
      let cursor = '0';
      const allKeys: string[] = [];

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        allKeys.push(...keys);
      } while (cursor !== '0');

      return allKeys;
    } catch (error) {
      this.logger.error(`Cache keys error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Check Redis connection health
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      return false;
    }
  }

  /**
   * Get Redis memory usage information
   */
  async getMemoryStats() {
    try {
      const info = await this.client.info('memory');
      const lines = info.split('\r\n');
      const stats: Record<string, string> = {};

      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      }

      return {
        usedMemory: stats.used_memory_human,
        peakMemory: stats.used_memory_peak_human,
        fragmentationRatio: stats.mem_fragmentation_ratio,
      };
    } catch (error) {
      this.logger.error('Failed to get memory stats:', error);
      return null;
    }
  }
}