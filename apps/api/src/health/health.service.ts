import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    private readonly queueService: QueueService,
  ) {}

  async checkDatabaseDetailed() {
    try {
      // Active connections
      const active = await this.db.$queryRaw`SELECT count(*)::int as active FROM pg_stat_activity WHERE state = 'active'`;
      const idle = await this.db.$queryRaw`SELECT count(*)::int as idle FROM pg_stat_activity WHERE state = 'idle'`;
      const dbname = await this.db.$queryRaw`SELECT current_database() as name`;

      return {
        status: 'ok',
        active: Number(active[0]?.active ?? 0),
        idle: Number(idle[0]?.idle ?? 0),
        database: dbname[0]?.name ?? null,
      };
    } catch (error) {
      this.logger.error('Database detailed check failed', error as any);
      return { status: 'error', error: (error as Error).message };
    }
  }

  async checkRedisDetailed() {
    try {
      const info = await this.cache.info();
      // Parse a few keys from INFO output
      const lines = info.split('\n');
      const map: Record<string, string> = {};
      for (const line of lines) {
        if (!line || line.startsWith('#')) continue;
        const [k, v] = line.split(':');
        if (k && v) map[k.trim()] = v.trim();
      }

      const usedMemory = map['used_memory'] ?? null;
      const connectedClients = map['connected_clients'] ?? null;
      const evictedKeys = map['evicted_keys'] ?? null;
      const keyspaceHits = Number(map['keyspace_hits'] ?? 0);
      const keyspaceMisses = Number(map['keyspace_misses'] ?? 0);
      const hitRate = keyspaceHits + keyspaceMisses > 0 ? keyspaceHits / (keyspaceHits + keyspaceMisses) : null;

      return {
        status: 'ok',
        usedMemory,
        connectedClients: connectedClients ? Number(connectedClients) : null,
        evictedKeys: evictedKeys ? Number(evictedKeys) : null,
        hitRate,
      };
    } catch (error) {
      this.logger.error('Redis detailed check failed', error as any);
      return { status: 'error', error: (error as Error).message };
    }
  }

  async checkQueuesDetailed() {
    try {
      const queues = await this.queueService.getAllQueues();
      return { status: 'ok', queues };
    } catch (error) {
      this.logger.error('Queue detailed check failed', error as any);
      return { status: 'error', error: (error as Error).message };
    }
  }

  async checkYouTubeApi(apiKey: string | undefined) {
    try {
      if (!apiKey) return { status: 'unknown', reason: 'no_api_key' };
      // Simple quota check using YouTube API quota endpoint is not directly available
      // We'll do a lightweight call and return response time
      const start = Date.now();
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=false&key=${apiKey}`);
      const elapsed = Date.now() - start;
      return { status: res.ok ? 'ok' : 'error', statusCode: res.status, responseTimeMs: elapsed };
    } catch (error) {
      this.logger.error('YouTube API check failed', error as any);
      return { status: 'error', error: (error as Error).message };
    }
  }

  async readiness() {
    // readiness: DB, Redis, Queue
    const [db, redis, queues] = await Promise.all([
      this.checkDatabaseDetailed(),
      this.checkRedisDetailed(),
      this.checkQueuesDetailed(),
    ]);

    const ok = db.status === 'ok' && redis.status === 'ok' && queues.status === 'ok';

    return { status: ok ? 'ready' : 'not-ready', details: { db, redis, queues } };
  }

  async liveness() {
    // liveness: basic process alive + optional light DB ping
    try {
      await this.db.$queryRaw`SELECT 1`; // quick ping
      return { status: 'alive' };
    } catch (error) {
      return { status: 'dead', error: (error as Error).message };
    }
  }
}
