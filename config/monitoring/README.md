# Monitoring Configuration

This directory contains configuration files for the HBCU Band Hub monitoring stack.

## Files

### `prometheus.yml`
Prometheus server configuration including:
- Scrape targets (API, Worker)
- Scrape intervals and timeouts
- Alert rule files
- Storage retention settings
- Alert manager integration

### `alertmanager.yml`
Alert Manager configuration including:
- Alert routing rules by severity
- Notification receivers (PagerDuty, Slack, Email)
- Inhibition rules to prevent alert fatigue
- Alert grouping and deduplication

### `grafana-datasources.yml`
Grafana data source provisioning:
- Prometheus as default data source
- Connection settings
- Query timeout configuration

### `../docker-compose.monitoring.yml`
Docker Compose setup for the monitoring stack:
- Prometheus
- Grafana
- Alert Manager

## Quick Start

### 1. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Slack (in alertmanager.yml)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty (in alertmanager.yml)
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key

# Email (in alertmanager.yml)
SMTP_PASSWORD=your-email-app-password
```

### 2. Update Configuration Files

**Slack Integration:**
Edit `alertmanager.yml` and replace:
```yaml
slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
```

**PagerDuty Integration:**
Edit `alertmanager.yml` and replace:
```yaml
routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
```

**Email Configuration:**
Edit `alertmanager.yml` and update:
```yaml
email_configs:
  - to: 'ops@hbcubandhub.com'
    from: 'alerts@hbcubandhub.com'
    auth_username: 'alerts@hbcubandhub.com'
    auth_password: 'YOUR_EMAIL_APP_PASSWORD'
```

### 3. Start Monitoring Stack

```bash
# From project root
docker-compose -f docker-compose.monitoring.yml up -d

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down
```

### 4. Access Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/your-password)
- **Alert Manager**: http://localhost:9093

### 5. Import Grafana Dashboards

Dashboards are automatically provisioned from `grafana/dashboards/` directory.

To manually import:
1. Go to Grafana → Dashboards → Import
2. Upload JSON file from `grafana/dashboards/`
3. Select Prometheus data source
4. Click Import

## Configuration Details

### Prometheus Scrape Targets

The configuration expects these services to be running:

```yaml
- api:3001/api/metrics      # NestJS API metrics
- worker:3002/metrics        # Worker metrics
```

Update targets in `prometheus.yml` based on your deployment:

**For local development:**
```yaml
- targets: ['localhost:3001']
```

**For Docker:**
```yaml
- targets: ['api:3001']
```

**For Kubernetes:**
```yaml
kubernetes_sd_configs:
  - role: pod
    namespaces:
      names:
        - bandhub-production
```

### Alert Severity Levels

| Severity | Priority | Channel    | Response Time |
|----------|----------|------------|---------------|
| Critical | P1       | PagerDuty  | Immediate     |
| Warning  | P2       | Slack      | 1 hour        |
| Info     | P3       | Email      | Next day      |

### Alert Inhibition

Inhibition rules prevent alert spam by suppressing related alerts:

1. If `AllHealthChecksFailing` fires, suppress individual component alerts
2. If `ApiHighErrorRate` fires, suppress performance alerts
3. If `DatabaseConnectionFailure` fires, suppress slow query alerts
4. If `MemoryCritical` fires, suppress memory warning alerts

### Retention Settings

**Prometheus:**
- Time: 15 days
- Size: 10 GB

To increase retention:
```yaml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 50GB
```

**Grafana:**
- No retention limit (uses Prometheus data)

**Alert Manager:**
- Alerts kept for resolution timeout (5 minutes default)

## Testing

### Test Prometheus Configuration

```bash
# Validate configuration
docker exec bandhub-prometheus promtool check config /etc/prometheus/prometheus.yml

# Validate alert rules
docker exec bandhub-prometheus promtool check rules /etc/prometheus/alerting-rules.yml

# Reload configuration (hot reload)
curl -X POST http://localhost:9090/-/reload
```

### Test Alert Manager Configuration

```bash
# Validate configuration
docker exec bandhub-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# View routing tree
docker exec bandhub-alertmanager amtool config routes show

# Send test alert
docker exec bandhub-alertmanager amtool alert add test_alert \
  --annotation=summary="Test Alert" \
  --annotation=description="This is a test" \
  severity=warning \
  priority=P2 \
  channel=slack
```

### Test Notifications

#### Slack
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from BandHub monitoring"}' \
  YOUR_SLACK_WEBHOOK_URL
```

#### PagerDuty
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Token token=YOUR_API_KEY' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Test alert",
      "severity": "critical",
      "source": "bandhub-test"
    }
  }' \
  https://events.pagerduty.com/v2/enqueue
```

## Troubleshooting

### Prometheus Not Scraping

**Check targets:**
```bash
curl http://localhost:9090/api/v1/targets | jq
```

**Common issues:**
1. Service not reachable (check network/firewall)
2. Wrong port or path
3. Metrics endpoint not exposed

**Fix:**
```bash
# Test metrics endpoint
curl http://api:3001/api/metrics

# Check Docker network
docker network inspect monitoring_monitoring
```

### Alerts Not Firing

**Check alert status:**
```bash
curl http://localhost:9090/api/v1/alerts | jq
```

**Common issues:**
1. Alert expression syntax error
2. Metric not available
3. Threshold not met
4. Evaluation interval too long

**Debug:**
```bash
# Test alert expression
curl 'http://localhost:9090/api/v1/query?query=bandhub_api_requests_total'

# Check rule evaluation
docker logs bandhub-prometheus | grep -i error
```

### Notifications Not Sent

**Check Alert Manager status:**
```bash
curl http://localhost:9093/api/v2/status | jq
```

**Common issues:**
1. Wrong webhook URL
2. Authentication failed
3. Alert inhibited
4. Network connectivity

**Debug:**
```bash
# View active alerts
curl http://localhost:9093/api/v2/alerts | jq

# Check Alert Manager logs
docker logs bandhub-alertmanager | grep -i error
```

### Grafana Dashboard Not Loading

**Common issues:**
1. Data source not configured
2. Query syntax error
3. Time range has no data

**Fix:**
```bash
# Test data source
curl -u admin:password http://localhost:3000/api/datasources

# Test query
curl -u admin:password 'http://localhost:3000/api/ds/query' \
  -H 'Content-Type: application/json' \
  -d '{"queries":[{"expr":"up","refId":"A"}]}'
```

## Maintenance

### Backup Configuration

```bash
# Backup all configurations
tar -czf monitoring-config-backup-$(date +%Y%m%d).tar.gz \
  config/monitoring/ \
  alerting-rules.yml \
  grafana/dashboards/

# Backup Grafana data
docker cp bandhub-grafana:/var/lib/grafana grafana-data-backup-$(date +%Y%m%d)
```

### Update Services

```bash
# Pull latest images
docker-compose -f docker-compose.monitoring.yml pull

# Restart with new images
docker-compose -f docker-compose.monitoring.yml up -d

# Clean up old images
docker image prune -f
```

### View Resource Usage

```bash
# Container stats
docker stats bandhub-prometheus bandhub-grafana bandhub-alertmanager

# Prometheus storage size
docker exec bandhub-prometheus du -sh /prometheus

# Grafana storage size
docker exec bandhub-grafana du -sh /var/lib/grafana
```

## Security

### Change Default Passwords

```bash
# Grafana admin password
docker exec -it bandhub-grafana grafana-cli admin reset-admin-password newpassword

# Or set via environment variable
GRAFANA_ADMIN_PASSWORD=newsecurepassword docker-compose -f docker-compose.monitoring.yml up -d
```

### Enable HTTPS

Update `prometheus.yml` and `alertmanager.yml` for TLS:

```yaml
tls_config:
  cert_file: /path/to/cert.pem
  key_file: /path/to/key.pem
```

### Restrict Access

Use firewall rules or reverse proxy:

```bash
# Allow only specific IPs
iptables -A INPUT -p tcp --dport 9090 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 9090 -j DROP
```

## Support

For issues or questions:
- Check the [main monitoring documentation](../../docs/MONITORING_SETUP.md)
- Review logs: `docker-compose -f docker-compose.monitoring.yml logs`
- Contact DevOps team in #monitoring Slack channel
- Create GitHub issue with `monitoring` label
