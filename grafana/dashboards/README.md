# Grafana Dashboards

This directory contains Grafana dashboard definitions for monitoring the HBCU Band Hub platform.

## Available Dashboards

### 1. API Performance (`api-performance.json`)
Monitors API health and performance metrics.

**Key Metrics:**
- Requests per second (total, 2xx, 4xx, 5xx)
- API error rate percentage
- Latency percentiles (p50, p95, p99)
- Top 10 slowest endpoints
- Requests by endpoint
- HTTP status code distribution
- Average response time by endpoint

**Alert Thresholds:**
- 🟢 Green: p95 < 2s, error rate < 1%
- 🟡 Yellow: p95 < 3s, error rate < 5%
- 🔴 Red: p95 > 3s, error rate > 5%

**Use Cases:**
- Identifying slow endpoints
- Detecting error rate spikes
- Monitoring API SLOs
- Performance regression detection

---

### 2. Database Metrics (`database-metrics.json`)
Monitors PostgreSQL database performance and health.

**Key Metrics:**
- Queries per second (QPS)
- Database connection pool status (active/idle)
- Query latency percentiles (p50, p95, p99)
- Slow queries (>5s)
- Queries by operation type
- Queries by table
- Connection pool utilization %
- Average query duration by table

**Alert Thresholds:**
- 🟢 Green: Pool utilization < 70%, p95 latency < 0.5s
- 🟡 Yellow: Pool utilization < 80%, p95 latency < 1s
- 🔴 Red: Pool utilization > 80%, p95 latency > 1s

**Use Cases:**
- Detecting connection pool exhaustion
- Identifying slow queries
- Database performance tuning
- Query optimization

---

### 3. Cache Metrics (`cache-metrics.json`)
Monitors Redis cache performance and efficiency.

**Key Metrics:**
- Cache hit rate percentage (gauge)
- Redis memory usage
- Connected Redis clients
- Cache hits vs misses (time series)
- Cache hit rate over time
- Cache operations by name
- Redis evicted keys
- Cache hit rate by cache name
- Redis memory trend

**Alert Thresholds:**
- 🟢 Green: Hit rate > 85%
- 🟡 Yellow: Hit rate > 70%
- 🔴 Red: Hit rate < 70%

**Use Cases:**
- Optimizing cache TTLs
- Detecting cache invalidation issues
- Memory usage monitoring
- Cache strategy evaluation

---

### 4. Worker Metrics (`worker-metrics.json`)
Monitors BullMQ background job processing.

**Key Metrics:**
- Job completion rate (success/failure)
- Job success rate percentage (gauge)
- Queue depth by queue (waiting/active/delayed)
- Active workers
- Job processing time percentiles (p50, p95, p99)
- Processing time by job type
- Job throughput by queue
- Failed job trends
- Current queue depth alert
- Job success rate by queue

**Alert Thresholds:**
- 🟢 Green: Success rate > 95%, queue depth < 50
- 🟡 Yellow: Success rate > 90%, queue depth < 100
- 🔴 Red: Success rate < 90%, queue depth > 100

**Use Cases:**
- Detecting job processing bottlenecks
- Monitoring worker health
- Scaling workers based on queue depth
- Identifying failing job types

---

### 5. Business Metrics (`business-metrics.json`)
Tracks business KPIs and user engagement.

**Key Metrics:**
- Videos synced (total count)
- Active user sessions
- Total search queries
- Featured band clicks
- Video sync rate (per minute)
- User activity events
- Authentication events
- Search queries by type
- Featured band click-through rate
- Videos synced by band
- API usage patterns (requests/hour)
- User activity by type

**Use Cases:**
- Product analytics
- User engagement monitoring
- Feature usage tracking
- Business growth metrics

---

## Dashboard Import Instructions

### Method 1: Using Grafana UI

1. Open Grafana web interface
2. Navigate to **Dashboards** → **Import**
3. Click **Upload JSON file**
4. Select a dashboard JSON file from this directory
5. Select the Prometheus data source
6. Click **Import**

### Method 2: Using Provisioning (Recommended)

1. Copy dashboard files to Grafana provisioning directory:
   ```bash
   cp grafana/dashboards/*.json /etc/grafana/provisioning/dashboards/
   ```

2. Create dashboard provider configuration:
   ```yaml
   # /etc/grafana/provisioning/dashboards/provider.yml
   apiVersion: 1
   providers:
     - name: 'BandHub'
       orgId: 1
       folder: 'BandHub Monitoring'
       type: file
       disableDeletion: false
       updateIntervalSeconds: 10
       allowUiUpdates: true
       options:
         path: /etc/grafana/provisioning/dashboards
   ```

3. Restart Grafana:
   ```bash
   docker-compose restart grafana
   ```

### Method 3: Using Grafana API

```bash
# Set your Grafana API key
GRAFANA_API_KEY="your-api-key"
GRAFANA_URL="http://localhost:3000"

# Import dashboard
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @api-performance.json \
  "$GRAFANA_URL/api/dashboards/db"
```

---

## Dashboard Customization

### Modifying Time Ranges

All dashboards default to 6-hour time windows. To change:
1. Click the time picker in the top-right
2. Select a preset range (1h, 6h, 24h, 7d, etc.)
3. Or use custom ranges
4. Click **Save dashboard** to persist

### Adjusting Refresh Rate

Default refresh: 30 seconds

To change:
1. Click the refresh dropdown (top-right)
2. Select: 5s, 10s, 30s, 1m, 5m, etc.
3. Or disable auto-refresh

### Adding Panels

1. Click **Add panel** (top toolbar)
2. Select **Add a new panel**
3. Configure query:
   ```promql
   bandhub_metric_name{label="value"}
   ```
4. Customize visualization options
5. Save changes

### Creating Alerts

1. Edit a panel
2. Go to **Alert** tab
3. Click **Create alert rule from this panel**
4. Configure:
   - Condition: When metric is above/below threshold
   - Evaluation interval
   - Pending period
   - Notification channel
5. Save alert rule

---

## Dashboard Variables

Some dashboards support template variables for filtering:

### Available Variables:

- `$environment` - Filter by environment (production, staging, development)
- `$service` - Filter by service (api, worker, web)
- `$namespace` - Kubernetes namespace (if applicable)

### Using Variables:

Add to dashboard JSON:
```json
{
  "templating": {
    "list": [
      {
        "name": "environment",
        "type": "query",
        "query": "label_values(bandhub_api_requests_total, environment)",
        "current": {
          "text": "production",
          "value": "production"
        }
      }
    ]
  }
}
```

Use in queries:
```promql
bandhub_api_requests_total{environment="$environment"}
```

---

## Dashboard Maintenance

### Version Control

All dashboard changes should be:
1. Exported from Grafana as JSON
2. Committed to this repository
3. Reviewed in pull requests

### Export from Grafana:

1. Open dashboard
2. Click **Share** (top toolbar)
3. Select **Export** tab
4. Toggle **Export for sharing externally**
5. Click **Save to file**
6. Replace the corresponding file in this directory

### Dashboard Testing:

Before committing dashboard changes:
```bash
# Validate JSON syntax
jq . grafana/dashboards/api-performance.json > /dev/null

# Run CI validation
npm run test:monitoring
```

---

## Troubleshooting

### Dashboard shows "No data"

**Check:**
1. Prometheus data source is configured correctly
2. Metrics are being scraped: `http://localhost:9090/targets`
3. Query syntax is correct
4. Time range includes data points

**Fix:**
```bash
# Test metric availability
curl http://localhost:9090/api/v1/query?query=bandhub_api_requests_total

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### Queries are slow

**Solutions:**
1. Reduce time range
2. Increase scrape interval
3. Use recording rules for complex queries
4. Add query result caching

Example recording rule:
```yaml
groups:
  - name: bandhub-recording-rules
    interval: 30s
    rules:
      - record: job:api_request_rate:5m
        expr: sum(rate(bandhub_api_requests_total[5m]))
```

### Dashboard not updating

**Check:**
1. Auto-refresh is enabled
2. Prometheus is scraping metrics
3. Time range is set to "now"

**Fix:**
```bash
# Force dashboard refresh
# Click refresh icon or press Ctrl+R
```

---

## Dashboard Screenshots

Example visualizations:

### API Performance Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Requests per Second         │ API Error Rate %          │
│ ▂▃▅▇█▇▅▃▂                  │ ▁▁▁▂▂▁▁▁▁                 │
│ 1.2K RPS                    │ 0.8%                      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ API Latency Percentiles                                 │
│ p50: ▁▂▂▁▁▂▁ (0.15s)                                   │
│ p95: ▂▃▄▃▂▃▂ (0.45s)                                   │
│ p99: ▄▅▆▅▄▅▄ (1.2s)                                    │
└─────────────────────────────────────────────────────────┘
```

### Database Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Connection Pool             │ Pool Utilization          │
│ Active:  8                  │ ████████░░ 75%            │
│ Idle:    4                  │                           │
│ Total:   12                 │                           │
└─────────────────────────────────────────────────────────┘
```

### Cache Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Cache Hit Rate                                          │
│ ████████████████░░ 87.5%                               │
│ 🟢 Healthy                                              │
└─────────────────────────────────────────────────────────┘
```

---

## Support

For dashboard issues or feature requests:
- Create an issue in the repository
- Tag with `monitoring` label
- Contact the DevOps team in #monitoring Slack channel

## Related Documentation

- [Monitoring Setup Guide](../MONITORING_SETUP.md)
- [Alert Rules Documentation](../../alerting-rules.yml)
- [Prometheus Metrics](../../libs/observability/src/metrics.ts)
- [Health Check Endpoints](../../apps/api/src/health/)
