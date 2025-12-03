import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis; // Added definite assignment assertion

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      maxRetriesPerRequest: null, // Add this for BullMQ compatibility
    });

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Expose Redis INFO for health/metrics purposes
  async info(section?: string): Promise<string> {
    return this.client.info(section);
  }

  // Expose the underlying client if needed (use cautiously)
  getClient() {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

async delPattern(pattern: string): Promise<void> {
  try {
    // Use SCAN instead of KEYS for better performance
    let cursor = '0';
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
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console. error(`Cache delPattern error for pattern ${pattern}:`, error);
  }
}

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}