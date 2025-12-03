import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'bandhub_' });

export const apiLatency = new Histogram({
  name: 'bandhub_api_latency_seconds',
  help: 'API latency in seconds',
  labelNames: ['route', 'method', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const dbQueryHistogram = new Histogram({
  name: 'bandhub_db_query_seconds',
  help: 'Database query durations',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [registry],
});

export const redisHitCounter = new Counter({
  name: 'bandhub_redis_hits_total',
  help: 'Redis cache hits',
  labelNames: ['cache_name'],
  registers: [registry],
});

export const redisMissCounter = new Counter({
  name: 'bandhub_redis_misses_total',
  help: 'Redis cache misses',
  labelNames: ['cache_name'],
  registers: [registry],
});

export const youtubeQuotaGauge = new Gauge({
  name: 'bandhub_youtube_quota_remaining',
  help: 'Remaining YouTube API quota',
  labelNames: ['window'],
  registers: [registry],
});

export const youtubeQuotaUsed = new Gauge({
  name: 'bandhub_youtube_quota_used',
  help: 'Used YouTube API quota',
  labelNames: ['window'],
  registers: [registry],
});

export const jobResultCounter = new Counter({
  name: 'bandhub_video_sync_results_total',
  help: 'Video sync job results',
  labelNames: ['queue', 'result'],
  registers: [registry],
});

export const authEventCounter = new Counter({
  name: 'bandhub_auth_events_total',
  help: 'Authentication events',
  labelNames: ['type'],
  registers: [registry],
});

export const featureClickCounter = new Counter({
  name: 'bandhub_featured_band_clicks_total',
  help: 'Featured band clicks',
  labelNames: ['band_id'],
  registers: [registry],
});
