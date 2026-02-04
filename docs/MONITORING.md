# Monitoring & Observability Guide

Comprehensive monitoring, alerting, and observability for the HBCU Band Hub platform.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Error Monitoring (Sentry)](#error-monitoring-sentry)
4. [Metrics & Visualization (Prometheus & Grafana)](#metrics--visualization-prometheus--grafana)
5. [Health Checks](#health-checks)
6. [Job Monitoring](#job-monitoring)
7. [Alerting & Notifications](#alerting--notifications)
8. [Dashboards](#dashboards)
9. [Troubleshooting](#troubleshooting)
10. [Runbook](#runbook)

---

## Overview

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   NestJS    │────▶│  Prometheus  │────▶│    Grafana    │
│     API     │     │   (Metrics)  │     │  (Dashboards) │
└─────────────┘     └──────────────┘     └───────────────┘
       │                     │
       │                     ▼
       │            ┌──────────────┐
       │            │    Alert     │
       │            │   Manager    │
       │            └──────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐     ┌──────────────┐
│   Sentry    │     │  PagerDuty   │
│   (Errors)  │     │   / Slack    │
└─────────────┘     └──────────────┘
```

### Monitoring Stack

- **Sentry**: Error tracking and performance monitoring
- **Prometheus**: Metrics collection and time-series storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Pino**: Structured logging
- **OpenTelemetry**: Distributed tracing
- **BullMQ**: Job queue monitoring

### Metrics Summary

**Total Metrics**: 30+

| Category | Count | Examples |
|----------|-------|----------|
| API Performance | 4 | Requests/sec, error rate, latency percentiles |
| Database | 8 | Connection pool, query performance, slow queries |
| Redis/Cache | 6 | Hit rate, memory usage, evicted keys |
| Worker Jobs | 4 | Queue depth, processing time, job results |
| YouTube API | 4 | Quota usage, API latency, call counter |
| Business | 4 | Videos synced, searches, user activity |
| System Health | 2 | Health status, memory usage |

---

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start Prometheus, Grafana, and AlertManager
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker ps | grep -E "prometheus|grafana|alertmanager"
```

### 2. Configure Environment Variables

```bash
# Sentry Configuration
SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0
RELEASE=v1.0.0
NODE_ENV=production

# Grafana
GRAFANA_ADMIN_PASSWORD=your-secure-password
```

### 3. Access Monitoring Tools

- **Grafana**: http://localhost:3000 (admin / your-password)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **API Metrics**: http://localhost:3001/api/metrics
- **API Health**: http://localhost:3001/api/health

### 4. Import Dashboards

Dashboards are auto-provisioned from `grafana/dashboards/`:
- API Performance
- Database Metrics
- Cache Metrics
- Worker Metrics
- Business Metrics

---

## Error Monitoring (Sentry)

### Setup

1. **Create Sentry Project**
   - Sign up at [sentry.io](https://sentry.io)
   - Create project for "Node.js"
   - Copy DSN

2. **Configure Application**

```bash
# .env
SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0
RELEASE=v1.0.0
```

### Features

#### Error Grouping
Errors are automatically grouped by:
- **Database errors** (Prisma) - grouped by error type
- **Rate limit errors** - grouped together
- **Validation errors** - grouped by validation type
- **External API errors** - grouped by service (YouTube, etc.)

#### Performance Monitoring
- 100% transaction sampling (reduce to 10% in production)
- 100% profile sampling for detailed analysis (reduce to 1% in production)
- Request/response timing
- Database query performance
- External API call latency

#### Context Enrichment
Every error includes:
- Correlation ID for cross-service tracing
- User information (ID, email)
- Service name (api, web, worker)
- Breadcrumbs with correlation IDs
- Release version

### Configure Alerts

Create these alerts in Sentry:

1. **Error Rate Alert**
   - Metric: Error rate
   - Threshold: > 10 errors/minute
   - Interval: 5 minutes
   - Action: Slack #alerts channel

2. **Performance Degradation**
   - Metric: p95 response time
   - Threshold: > 2 seconds
   - Interval: 10 minutes
   - Action: Slack #performance channel

---

## Metrics & Visualization (Prometheus & Grafana)

### Prometheus Configuration

File: `config/monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'hbcu-band-hub'
    environment: 'production'

rule_files:
  - 'alerting-rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  - job_name: 'bandhub-api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'bandhub-worker'
    static_configs:
      - targets: ['worker:3002']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Application Metrics

#### API Performance (4 metrics)
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_active` - Active requests gauge
- `api_error_rate` - Error rate by status code

#### Database (8 metrics)
- `db_connection_pool_active` - Active connections
- `db_connection_pool_idle` - Idle connections
- `db_queries_total` - Total queries by operation/table
- `db_query_duration_seconds` - Query latency percentiles
- `db_slow_queries_total` - Queries taking > 5s
- Connection pool utilization (calculated)

**Alerts:**
- Connection pool > 80%
- Slow queries detected
- Query latency > 5s

#### Redis/Cache (6 metrics)
- `cache_hit_rate` - Cache hit percentage
- `cache_hits_total` - Total cache hits by name
- `cache_misses_total` - Total cache misses by name
- `redis_memory_bytes` - Redis memory usage
- `redis_connected_clients` - Connected clients
- `redis_evicted_keys_total` - Evicted keys counter

**Alerts:**
- Cache hit rate < 70%
- High eviction rate

#### Worker Jobs (4 metrics)
- `job_queue_depth` - Jobs waiting/active/delayed by queue
- `job_processing_time_seconds` - Job duration histogram
- `job_results_total` - Job outcomes (success/failure) by queue
- `worker_active_jobs` - Currently processing jobs

**Alerts:**
- Queue depth > 100
- Job failure rate > 10%

#### YouTube API (4 metrics)
- `youtube_api_quota_used` - Quota consumed
- `youtube_api_quota_remaining` - Quota available
- `youtube_api_calls_total` - API calls by endpoint
- `youtube_api_latency_seconds` - API response time

**Alerts:**
- Quota > 80% used

### Grafana Setup

#### Data Source Configuration

File: `config/monitoring/grafana-datasources.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

#### Dashboard Provisioning

Dashboards are automatically loaded from `grafana/dashboards/`:

1. **api-performance.json**
   - Requests per second
   - Error rate percentage
   - Latency percentiles (p50, p95, p99)
   - Top 10 slowest endpoints
   - HTTP status code distribution

2. **database-metrics.json**
   - Queries per second
   - Connection pool status
   - Query latency percentiles
   - Slow query identification
   - Queries by operation type

3. **cache-metrics.json**
   - Cache hit rate %
   - Redis memory usage
   - Connected clients
   - Evicted keys
   - Hit rate trends

4. **worker-metrics.json**
   - Job completion rate
   - Queue depth by queue
   - Processing time percentiles
   - Job throughput
   - Failed job trends

5. **business-metrics.json**
   - Videos synced
   - Active user sessions
   - Search queries
   - Featured band clicks
   - API usage patterns

---

## Health Checks

### Endpoints

The API exposes comprehensive health checks:

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `/api/health` | Overall health | Timestamp, status |
| `/api/health/ready` | Readiness probe | Database, Redis, Queues |
| `/api/health/live` | Liveness probe | Basic ping |
| `/api/health/database` | Database status | Connection, query test, connection count |
| `/api/health/cache` | Redis status | Connection, memory, hit rate |
| `/api/health/queues` | BullMQ status | Queue counts, paused state |

### Health Check Responses

#### Overall Health (`/api/health`)
```json
{
  "status": "healthy",
  "timestamp": "2026-02-03T10:30:00.000Z",
  "uptime": 86400
}
```

#### Readiness (`/api/health/ready`)
```json
{
  "status": "ready",
  "checks": {
    "database": "healthy",
    "cache": "healthy",
    "queues": "healthy"
  },
  "timestamp": "2026-02-03T10:30:00.000Z"
}
```

#### Database Detail (`/api/health/database`)
```json
{
  "status": "healthy",
  "details": {
    "connected": true,
    "activeConnections": 8,
    "idleConnections": 12,
    "responseTime": 15
  }
}
```

### External Monitoring

#### UptimeRobot Setup

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add Monitor:
   - Type: HTTP(s)
   - URL: `https://api.hbcubandhub.com/api/health`
   - Interval: 5 minutes
   - Expected keyword: `"status":"healthy"`
3. Configure alert contacts

#### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Job Monitoring

### Real-Time Job Metrics

#### GET `/api/v1/admin/jobs/metrics`

Returns comprehensive job statistics:

```json
{
  "timestamp": "2026-02-03T10:30:00.000Z",
  "queues": [
    {
      "queueName": "youtube-sync",
      "waiting": 15,
      "active": 3,
      "completed": 1250,
      "failed": 42,
      "delayed": 5,
      "paused": false
    }
  ],
  "totals": {
    "waiting": 25,
    "active": 5,
    "completed": 3500,
    "failed": 98,
    "delayed": 10
  },
  "successRate": 97.29,
  "processingRate": 12.5
}
```

#### GET `/api/v1/admin/jobs/live` (Server-Sent Events)

Real-time updates every 2 seconds:

```typescript
const eventSource = new EventSource('/api/v1/admin/jobs/live');
eventSource.onmessage = (event) => {
  const metrics = JSON.parse(event.data);
  console.log('Live metrics:', metrics);
};
```

### Stuck Job Detection

#### GET `/api/v1/admin/jobs/alerts/stuck`

Identifies jobs stuck in active state:

**Severity Levels:**
- **Low**: 10-30 minutes
- **Medium**: 30-60 minutes
- **High**: 1-2 hours
- **Critical**: > 2 hours

```json
[
  {
    "jobId": "12345",
    "queueName": "youtube-sync",
    "jobName": "sync-band",
    "stuckDuration": 1800000,
    "severity": "medium",
    "startedAt": "2026-02-03T10:00:00.000Z",
    "data": { "bandId": "abc123" },
    "attemptsMade": 2
  }
]
```

### Queue Management

#### Pause Queue
```bash
PATCH /api/v1/admin/jobs/queue/:queueName/pause
```

#### Resume Queue
```bash
PATCH /api/v1/admin/jobs/queue/:queueName/resume
```

#### Clear Failed Jobs
```bash
DELETE /api/v1/admin/jobs/queue/:queueName/clear?type=failed
```

### Sync Job Monitoring UI

Access at `/admin/sync-jobs` with MODERATOR+ role.

**Features:**
- Real-time job table with status badges
- Filter by status, type, band, date range
- Auto-refresh every 30 seconds for active jobs
- Manual sync trigger
- Job retry functionality
- Error tracking and aggregation
- Queue status dashboard

**API Endpoints:**
- `GET /api/admin/sync-jobs` - List jobs with filters
- `GET /api/admin/sync-jobs/:id` - Get job details
- `POST /api/admin/sync-jobs/:id/retry` - Retry failed job
- `POST /api/admin/sync-jobs/trigger` - Trigger manual sync
- `GET /api/admin/queue/status` - Get queue metrics
- `GET /api/admin/sync/errors` - Get error statistics

---

## Alerting & Notifications

### Alert Severity Tiers

| Severity | Priority | Channel | Response Time | Count |
|----------|----------|---------|---------------|-------|
| Critical | P1 | PagerDuty | Immediate | 5 |
| Warning | P2 | Slack | < 1 hour | 10 |
| Info | P3 | Email | Next day | 4 |

### Critical Alerts (P1)

1. **DatabaseConnectionFailure**
   - Database connection lost
   - Action: Restart database, check credentials

2. **ApiHighErrorRate**
   - 5xx error rate > 5%
   - Action: Check application logs, rollback if needed

3. **AllHealthChecksFailing**
   - All health endpoints returning unhealthy
   - Action: Check infrastructure, network

4. **MemoryCritical**
   - Memory usage > 95%
   - Action: Restart services, investigate memory leak

5. **RedisConnectionFailure**
   - Redis connection lost
   - Action: Restart Redis, check network

### Warning Alerts (P2)

1. **DatabaseSlowQueries** - Queries taking > 5s
2. **HighMemoryUsage** - Memory > 85%
3. **CacheHitRateLow** - Cache hit rate < 70%
4. **QueueDepthHigh** - Queue > 100 jobs
5. **ApiLatencyP95High** - P95 latency > 3s
6. **ApiLatencyP99High** - P99 latency > 5s
7. **DatabaseConnectionPoolUtilization** - Pool > 80%
8. **WorkerJobFailureRate** - Job failure > 10%
9. **RedisEvictionRateHigh** - High key eviction
10. **DatabaseQueryLatencyHigh** - High query latency

### Info Alerts (P3)

1. **YouTubeQuotaHigh** - Quota > 80% used
2. **ApiErrorRateElevated** - 4xx errors > 10%
3. **HighAuthenticationFailureRate** - Auth failures > 30%

### AlertManager Configuration

File: `config/monitoring/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true
    
    - match:
        severity: warning
      receiver: 'slack-warnings'
    
    - match:
        severity: info
      receiver: 'email-info'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
        severity: 'critical'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts'
        title: '⚠️ Warning Alert'
        text: |
          *Alert:* {{ .GroupLabels.alertname }}
          *Summary:* {{ .CommonAnnotations.summary }}

  - name: 'email-info'
    email_configs:
      - to: 'ops@hbcubandhub.com'
```

### PagerDuty Integration

1. **Create Service**
   - Go to Services → New Service
   - Name: "HBCU Band Hub Production"
   - Integration: Events API v2
   - Copy Integration Key

2. **Escalation Policy**
   - Level 1: On-call engineer (immediately)
   - Level 2: Engineering manager (after 15 min)
   - Level 3: CTO (after 30 min)

### Slack Integration

1. **Create Webhook**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Create app → Incoming Webhooks
   - Select channels: #alerts, #monitoring, #incidents

2. **Test Webhook**
```bash
curl -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"Test alert from BandHub"}' \
  YOUR_SLACK_WEBHOOK_URL
```

---

## Dashboards

### Dashboard Access

All dashboards auto-provisioned from `grafana/dashboards/`:

1. **API Performance** (`api-performance.json`)
   - Requests per second (total, 2xx, 4xx, 5xx)
   - Error rate percentage
   - Latency percentiles (p50, p95, p99)
   - Top 10 slowest endpoints
   - HTTP status distribution

2. **Database Metrics** (`database-metrics.json`)
   - Queries per second
   - Connection pool status
   - Query latency percentiles
   - Slow query identification
   - Queries by operation/table

3. **Cache Metrics** (`cache-metrics.json`)
   - Cache hit rate gauge & trend
   - Redis memory usage
   - Connected clients
   - Cache hits vs misses
   - Evicted keys

4. **Worker Metrics** (`worker-metrics.json`)
   - Job completion rate
   - Success rate gauge
   - Queue depth by queue
   - Processing time percentiles
   - Failed job trends

5. **Business Metrics** (`business-metrics.json`)
   - Videos synced
   - Active user sessions
   - Search queries
   - Featured band clicks
   - API usage patterns

### Importing Dashboards

Dashboards are auto-provisioned, but to manually import:

```bash
# Method 1: Auto-provision (recommended)
cp grafana/dashboards/*.json /path/to/grafana/provisioning/dashboards/

# Method 2: Grafana UI
# 1. Go to Dashboards → Import
# 2. Upload JSON file
# 3. Select Prometheus datasource

# Method 3: API
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @api-performance.json \
  http://localhost:3000/api/dashboards/db
```

---

## Troubleshooting

### Prometheus Not Scraping

**Symptoms:**
- No data in Grafana
- Targets showing "Down"

**Solutions:**
```bash
# Check metrics endpoint
curl http://localhost:3001/api/metrics

# Check Prometheus targets
# Go to http://localhost:9090/targets

# Verify network
docker network inspect monitoring_network

# Check logs
docker logs prometheus
```

### Grafana No Data

**Symptoms:**
- Dashboards show "No data"
- Query errors

**Solutions:**
```bash
# Test Prometheus datasource
# Grafana → Configuration → Data Sources → Test

# Verify metric names
curl http://localhost:9090/api/v1/label/__name__/values

# Check dashboard queries
# Edit panel → Query inspector
```

### Alerts Not Firing

**Symptoms:**
- Conditions met but no alerts
- AlertManager shows nothing

**Solutions:**
```bash
# Validate alert rules
docker exec prometheus promtool check rules /etc/prometheus/alerting-rules.yml

# Check alert evaluation
# Go to http://localhost:9090/alerts

# Test alert routing
docker exec alertmanager amtool config routes test \
  --config.file=/etc/alertmanager/alertmanager.yml \
  alertname=test severity=critical
```

### High Memory Usage

**Solutions:**
```bash
# Reduce retention in prometheus.yml
storage:
  tsdb:
    retention.time: 7d  # default is 15d

# Check metric cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq .
```

### Sentry Not Capturing Errors

**Solutions:**
```bash
# Verify DSN
echo $SENTRY_DSN

# Check logs for "Sentry initialized"

# Test error capture
curl -X POST http://localhost:3001/api/test-error

# Check sample rates
echo $SENTRY_TRACES_SAMPLE_RATE
```

### Debug Commands

```bash
# View Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Test Prometheus queries
curl 'http://localhost:9090/api/v1/query?query=up'

# Check AlertManager routing
docker exec alertmanager amtool config routes show

# View silences
docker exec alertmanager amtool silence query

# Check Grafana logs
docker logs grafana | tail -100

# Validate alert rules
docker exec prometheus promtool check rules /etc/prometheus/alerting-rules.yml
```

---

## Runbook

### Incident Response Workflow

1. **Alert Received** (1-2 min)
   - Identify which alert fired
   - Check severity (P1/P2/P3)
   - Acknowledge in PagerDuty

2. **Initial Triage** (3-5 min)
   - Check Grafana dashboards for trends
   - Review `/api/health` endpoints
   - Check application logs

3. **Database Issues**
   - Check `/api/health/database`
   - Verify connection count
   - Check for long-running queries:
     ```sql
     SELECT pid, query, state, query_start
     FROM pg_stat_activity
     WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';
     ```
   - Actions:
     - Scale app replicas if connection saturated
     - Cancel long-running queries if needed
     - Increase `max_connections` if necessary

4. **Redis Issues**
   - Check `/api/health/cache`
   - Monitor memory usage, evicted keys
   - Actions:
     - Evict large keys if memory pressure
     - Scale Redis or increase memory
     - Check cache configuration

5. **Queue Backlog**
   - Check `/api/health/queues`
   - View waiting/active/failed counts
   - Actions:
     - Scale workers if backlog increasing
     - Investigate failing jobs
     - Pause queue if necessary

6. **External API Failures**
   - Check YouTube API health
   - Monitor quota usage
   - Actions:
     - Enable circuit breaker
     - Pause sync jobs if quota exhausted
     - Update status page

7. **Mitigation**
   - Enable maintenance mode if needed
   - Roll back recent deployments
   - Scale resources temporarily
   - Communicate in #incidents Slack

8. **Post-Incident**
   - Create post-mortem document
   - Identify root cause
   - Add missing alerts/metrics
   - Update runbook

### Escalation Path

1. **Level 1**: Check this runbook for specific alert
2. **Level 2**: Review metrics in Grafana + logs
3. **Level 3**: Contact on-call engineer (PagerDuty)
4. **Level 4**: Create incident in #incidents Slack
5. **Level 5**: Escalate to engineering manager

### Common Alert Responses

#### DatabaseConnectionFailure (P1)
1. Check database service status
2. Verify credentials and connection string
3. Check network connectivity
4. Restart database if necessary
5. Check for deadlocks or blocking queries

#### ApiHighErrorRate (P1)
1. Check application logs for errors
2. Review recent deployments
3. Check external dependencies
4. Roll back if deployment-related
5. Scale resources if capacity issue

#### CacheHitRateLow (P2)
1. Check cache warming status
2. Verify Redis memory
3. Review cache key patterns
4. Check for cache invalidation issues
5. Adjust TTL values if needed

#### QueueDepthHigh (P2)
1. Check worker health and count
2. View stuck jobs via `/api/v1/admin/jobs/alerts/stuck`
3. Investigate failing jobs
4. Scale workers up
5. Increase concurrency if safe

### Maintenance Tasks

**Daily:**
- Review dashboard for anomalies
- Check alert history

**Weekly:**
- Clear completed jobs
- Review slow queries
- Check metric cardinality

**Monthly:**
- Review and tune alert thresholds
- Update runbook with new scenarios
- Archive old metrics
- Test disaster recovery

---

## Support Resources

- **Prometheus**: [prometheus.io/docs](https://prometheus.io/docs)
- **Grafana**: [grafana.com/docs](https://grafana.com/docs)
- **Sentry**: [docs.sentry.io](https://docs.sentry.io)
- **AlertManager**: [prometheus.io/docs/alerting](https://prometheus.io/docs/alerting)
- **BullMQ**: [docs.bullmq.io](https://docs.bullmq.io)

**Internal:**
- Team Slack: #bandhub-team
- Incidents: #incidents
- Monitoring: #monitoring
- On-call: PagerDuty schedule

---

## Next Steps

After setup:

1. ✅ Verify all dashboards display data
2. ✅ Test alert firing with test conditions
3. ✅ Confirm PagerDuty/Slack notifications
4. ✅ Create runbooks for each alert
5. ✅ Schedule monitoring review meetings
6. ✅ Train team on monitoring tools
7. ✅ Set up synthetic monitoring for critical flows
8. ✅ Configure log aggregation
9. ✅ Tune alert thresholds based on baseline
10. ✅ Document incident response procedures
