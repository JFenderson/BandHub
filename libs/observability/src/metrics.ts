import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'bandhub_' });

// API Performance Metrics
export const apiLatency = new Histogram({
  name: 'bandhub_api_latency_seconds',
  help: 'API latency in seconds',
  labelNames: ['route', 'method', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10],
  registers: [registry],
});

export const apiRequestsTotal = new Counter({
  name: 'bandhub_api_requests_total',
  help: 'Total API requests',
  labelNames: ['route', 'method', 'status_code'],
  registers: [registry],
});

export const apiErrorsTotal = new Counter({
  name: 'bandhub_api_errors_total',
  help: 'Total API errors',
  labelNames: ['route', 'method', 'error_type'],
  registers: [registry],
});

// Database Metrics
export const dbQueryHistogram = new Histogram({
  name: 'bandhub_db_query_seconds',
  help: 'Database query durations',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'bandhub_db_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'],
  registers: [registry],
});

export const dbQueriesTotal = new Counter({
  name: 'bandhub_db_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [registry],
});

export const dbSlowQueriesTotal = new Counter({
  name: 'bandhub_db_slow_queries_total',
  help: 'Total slow database queries (>5s)',
  labelNames: ['operation', 'table'],
  registers: [registry],
});

// Redis/Cache Metrics
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

export const redisMemoryUsage = new Gauge({
  name: 'bandhub_redis_memory_bytes',
  help: 'Redis memory usage in bytes',
  registers: [registry],
});

export const redisConnectedClients = new Gauge({
  name: 'bandhub_redis_connected_clients',
  help: 'Number of connected Redis clients',
  registers: [registry],
});

export const redisEvictedKeys = new Counter({
  name: 'bandhub_redis_evicted_keys_total',
  help: 'Total Redis evicted keys',
  registers: [registry],
});

// YouTube API Metrics
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

export const youtubeApiCallsTotal = new Counter({
  name: 'bandhub_youtube_api_calls_total',
  help: 'Total YouTube API calls',
  labelNames: ['endpoint', 'status'],
  registers: [registry],
});

export const youtubeApiLatency = new Histogram({
  name: 'bandhub_youtube_api_latency_seconds',
  help: 'YouTube API call latency',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

// Worker/Job Metrics
export const jobResultCounter = new Counter({
  name: 'bandhub_video_sync_results_total',
  help: 'Video sync job results',
  labelNames: ['queue', 'result'],
  registers: [registry],
});

export const jobProcessingTime = new Histogram({
  name: 'bandhub_job_processing_seconds',
  help: 'Job processing time',
  labelNames: ['job_type', 'queue'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

export const queueDepth = new Gauge({
  name: 'bandhub_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue', 'state'],
  registers: [registry],
});

export const workerActiveJobs = new Gauge({
  name: 'bandhub_worker_active_jobs',
  help: 'Number of currently processing jobs',
  labelNames: ['worker_id'],
  registers: [registry],
});

// Authentication Metrics
export const authEventCounter = new Counter({
  name: 'bandhub_auth_events_total',
  help: 'Authentication events',
  labelNames: ['type'],
  registers: [registry],
});

export const activeSessionsGauge = new Gauge({
  name: 'bandhub_active_sessions',
  help: 'Number of active user sessions',
  registers: [registry],
});

// Business Metrics
export const featureClickCounter = new Counter({
  name: 'bandhub_featured_band_clicks_total',
  help: 'Featured band clicks',
  labelNames: ['band_id'],
  registers: [registry],
});

export const videosSyncedTotal = new Counter({
  name: 'bandhub_videos_synced_total',
  help: 'Total videos synced',
  labelNames: ['source', 'band_id'],
  registers: [registry],
});

export const userActivityCounter = new Counter({
  name: 'bandhub_user_activity_total',
  help: 'User activity events',
  labelNames: ['activity_type', 'user_type'],
  registers: [registry],
});

export const searchQueriesTotal = new Counter({
  name: 'bandhub_search_queries_total',
  help: 'Total search queries',
  labelNames: ['search_type'],
  registers: [registry],
});

// System Health Metrics
export const healthCheckStatus = new Gauge({
  name: 'bandhub_health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['check_type'],
  registers: [registry],
});

export const memoryUsagePercent = new Gauge({
  name: 'bandhub_memory_usage_percent',
  help: 'Memory usage percentage',
  labelNames: ['type'],
  registers: [registry],
});
