# Monitoring Setup Guide

This guide provides comprehensive instructions for setting up monitoring and alerting for the HBCU Band Hub production environment.

## Table of Contents

1. [Overview](#overview)
2. [Sentry Setup](#sentry-setup)
3. [Prometheus & Grafana Setup](#prometheus--grafana-setup)
4. [Alert Manager Configuration](#alert-manager-configuration)
5. [PagerDuty Integration](#pagerduty-integration)
6. [Slack Integration](#slack-integration)
7. [Health Check Monitoring](#health-check-monitoring)
8. [Troubleshooting](#troubleshooting)

## Overview

HBCU Band Hub uses a comprehensive monitoring stack:

- **Sentry**: Error tracking and performance monitoring
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Pino**: Structured logging
- **OpenTelemetry**: Distributed tracing
- **BullMQ**: Job queue monitoring

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

## Sentry Setup

### 1. Create Sentry Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project for "Node.js"
3. Copy the DSN (Data Source Name)

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Sentry Configuration
SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0
RELEASE=v1.0.0  # Set this to your deployment version
NODE_ENV=production

# For Next.js frontend
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-frontend-project-id
NEXT_PUBLIC_RELEASE=v1.0.0
```

### 3. Sentry Features

The enhanced Sentry integration includes:

#### Error Grouping
Errors are automatically grouped by:
- Database errors (Prisma) - grouped by error type
- Rate limit errors - grouped together
- Validation errors - grouped by validation type
- External API errors - grouped by service (YouTube, etc.)

#### Performance Monitoring
- 100% transaction sampling in production
- 100% profile sampling for detailed performance analysis
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

### 4. Create Sentry Dashboard

1. Go to Sentry → Dashboards → Create Dashboard
2. Add widgets:
   - **Error Rate**: Shows errors per minute
   - **Affected Users**: Number of unique users experiencing errors
   - **Most Common Errors**: Top 10 errors by frequency
   - **Performance**: p95 response time trend
   - **Release Health**: Crash-free sessions by release

### 5. Configure Sentry Alerts

#### Error Rate Alert
```yaml
Metric: Error rate
Threshold: > 10 errors/minute
Interval: 5 minutes
Action: Send to Slack #alerts channel
```

#### Performance Degradation Alert
```yaml
Metric: p95 response time
Threshold: > 2 seconds
Interval: 10 minutes
Action: Send to Slack #performance channel
```

## Prometheus & Grafana Setup

### 1. Install Prometheus

#### Using Docker Compose

Create `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerting-rules.yml:/etc/prometheus/alerting-rules.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
```

### 2. Configure Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'hbcu-band-hub'
    environment: 'production'

# Load alerting rules
rule_files:
  - 'alerting-rules.yml'

# Alert manager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Scrape configurations
scrape_configs:
  # API metrics
  - job_name: 'bandhub-api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  # Worker metrics
  - job_name: 'bandhub-worker'
    static_configs:
      - targets: ['worker:3002']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### 3. Configure Grafana Data Source

Create `grafana/datasources/prometheus.yml`:

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

### 4. Import Grafana Dashboards

Create `grafana/dashboards/dashboard-provider.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'HBCU Band Hub'
    orgId: 1
    folder: 'BandHub'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

Copy dashboard JSON files:
```bash
cp grafana/dashboards/*.json /path/to/grafana/provisioning/dashboards/
```

### 5. Start Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

Access points:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/your-secure-password)
- AlertManager: http://localhost:9093

## Alert Manager Configuration

### 1. Configure AlertManager

Create `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

# Alert routing
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    # Critical alerts go to PagerDuty
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true
    
    # Warning alerts go to Slack
    - match:
        severity: warning
      receiver: 'slack-warnings'
    
    # Info alerts go to email
    - match:
        severity: info
      receiver: 'email-info'

# Alert receivers
receivers:
  - name: 'default'
    slack_configs:
      - channel: '#monitoring'
        title: 'BandHub Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
        severity: 'critical'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ .Alerts.Firing | len }}'
          description: '{{ .CommonAnnotations.description }}'
          runbook: '{{ .CommonAnnotations.runbook_url }}'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts'
        color: 'warning'
        title: '⚠️ Warning Alert'
        text: |
          *Alert:* {{ .GroupLabels.alertname }}
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          *Runbook:* {{ .CommonAnnotations.runbook_url }}

  - name: 'email-info'
    email_configs:
      - to: 'ops@hbcubandhub.com'
        from: 'alerts@hbcubandhub.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@hbcubandhub.com'
        auth_password: 'YOUR_EMAIL_PASSWORD'
        headers:
          Subject: '[BandHub] {{ .GroupLabels.alertname }}'

# Inhibition rules (suppress alerts)
inhibit_rules:
  # If all health checks are failing, suppress individual component alerts
  - source_match:
      alertname: 'AllHealthChecksFailing'
    target_match_re:
      alertname: '(DatabaseConnectionFailure|RedisConnectionFailure)'
    equal: ['cluster']
  
  # If error rate is critical, suppress performance alerts
  - source_match:
      alertname: 'ApiHighErrorRate'
    target_match_re:
      alertname: '(ApiLatencyP95High|ApiLatencyP99High)'
    equal: ['cluster']
```

### 2. Test AlertManager Configuration

```bash
# Validate configuration
docker exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Send test alert
docker exec alertmanager amtool alert add test_alert \
  --annotation=summary="Test Alert" \
  --annotation=description="This is a test"
```

## PagerDuty Integration

### 1. Create PagerDuty Service

1. Log into PagerDuty
2. Go to Services → New Service
3. Name: "HBCU Band Hub Production"
4. Integration Type: "Events API v2"
5. Copy the Integration Key

### 2. Configure Integration

Add to `alertmanager.yml`:

```yaml
receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_INTEGRATION_KEY'
        severity: '{{ if eq .GroupLabels.severity "critical" }}critical{{ else }}error{{ end }}'
        description: '{{ .GroupLabels.alertname }}'
        details:
          summary: '{{ .CommonAnnotations.summary }}'
          description: '{{ .CommonAnnotations.description }}'
          runbook_url: '{{ .CommonAnnotations.runbook_url }}'
          firing_alerts: '{{ .Alerts.Firing | len }}'
          num_affected_users: '{{ .CommonAnnotations.affected_users }}'
```

### 3. Set Up Escalation Policy

1. Go to People → Escalation Policies
2. Create policy: "BandHub Production Escalation"
3. Level 1: On-call engineer (immediately)
4. Level 2: Engineering manager (after 15 minutes)
5. Level 3: CTO (after 30 minutes)

### 4. Configure On-Call Schedule

1. Go to People → On-Call Schedules
2. Create schedule: "BandHub Production On-Call"
3. Set rotation: Weekly, Monday 9am
4. Add team members
5. Link to escalation policy

## Slack Integration

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → "From scratch"
3. Name: "BandHub Monitoring"
4. Select workspace

### 2. Configure Incoming Webhooks

1. Features → Incoming Webhooks → Activate
2. Add New Webhook to Workspace
3. Select channels:
   - `#alerts` for warnings
   - `#monitoring` for info
   - `#incidents` for critical
4. Copy webhook URLs

### 3. Update AlertManager Configuration

```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts'
        username: 'BandHub Monitor'
        icon_emoji: ':warning:'
        title: '{{ .GroupLabels.alertname }}'
        text: |
          *Priority:* {{ .GroupLabels.priority }}
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          {{ if .CommonAnnotations.runbook_url }}
          *Runbook:* {{ .CommonAnnotations.runbook_url }}
          {{ end }}
          *Firing Alerts:* {{ .Alerts.Firing | len }}
        actions:
          - type: button
            text: 'View in Grafana'
            url: 'http://grafana:3000'
          - type: button
            text: 'View in Prometheus'
            url: 'http://prometheus:9090'
```

### 4. Test Slack Integration

```bash
# Send test message
curl -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"Test alert from BandHub monitoring"}' \
  YOUR_SLACK_WEBHOOK_URL
```

## Health Check Monitoring

### 1. Configure Uptime Monitor

The API exposes comprehensive health checks at:
- `/api/health` - Overall health status
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe
- `/api/health/database` - Database status
- `/api/health/cache` - Redis/cache status
- `/api/health/queues` - BullMQ queue status

### 2. External Monitoring Services

#### Option A: UptimeRobot

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add New Monitor:
   - Type: HTTP(s)
   - URL: `https://api.hbcubandhub.com/api/health`
   - Interval: 5 minutes
3. Set up alert contacts (email, Slack, PagerDuty)

#### Option B: Pingdom

1. Sign up at [pingdom.com](https://pingdom.com)
2. Add New Check:
   - Name: "BandHub API Health"
   - URL: `https://api.hbcubandhub.com/api/health`
   - Interval: 5 minutes
   - Expected response: `"status":"healthy"`
3. Configure integrations

### 3. Create Public Status Page

#### Using Atlassian Statuspage

1. Sign up at [statuspage.io](https://statuspage.io)
2. Create components:
   - API
   - Database
   - Cache/Redis
   - Worker Jobs
   - YouTube Integration
3. Link to monitoring checks
4. Configure notification subscribers
5. Customize branding

Example components:
```
✓ API Service
✓ Database
✓ Cache Layer
✓ Background Workers
⚠ YouTube Integration (Performance Degraded)
```

### 4. Kubernetes Health Probes (if applicable)

Add to your deployment YAML:

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

## Troubleshooting

### Common Issues

#### 1. Prometheus Not Scraping Metrics

**Symptoms:**
- No data in Grafana dashboards
- Prometheus targets showing as "Down"

**Solutions:**
```bash
# Check if metrics endpoint is accessible
curl http://localhost:3001/api/metrics

# Check Prometheus targets
# Go to http://localhost:9090/targets

# Verify network connectivity
docker network inspect monitoring_network

# Check Prometheus logs
docker logs prometheus
```

#### 2. Grafana Dashboards Not Loading

**Symptoms:**
- Dashboards show "No data"
- "Error loading data" message

**Solutions:**
```bash
# Verify Prometheus data source
# Grafana → Configuration → Data Sources → Test

# Check dashboard queries
# Edit panel → Query inspector

# Verify metric names match
curl http://localhost:9090/api/v1/label/__name__/values
```

#### 3. Alerts Not Firing

**Symptoms:**
- No alerts received despite conditions being met
- AlertManager shows no active alerts

**Solutions:**
```bash
# Check alert rules
docker exec prometheus promtool check rules /etc/prometheus/alerting-rules.yml

# Verify alert evaluation
# Go to http://localhost:9090/alerts

# Check AlertManager status
curl http://localhost:9093/api/v2/status

# Test alert routing
docker exec alertmanager amtool config routes test \
  --config.file=/etc/alertmanager/alertmanager.yml \
  alertname=test severity=critical
```

#### 4. High Memory Usage

**Symptoms:**
- Prometheus using excessive memory
- Slow query performance

**Solutions:**
```bash
# Reduce retention period in prometheus.yml
storage:
  tsdb:
    retention.time: 15d  # default is 15d, try reducing to 7d

# Increase resources
docker-compose up -d --scale prometheus=1 --memory=2g

# Check metric cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq .
```

#### 5. Sentry Not Capturing Errors

**Symptoms:**
- No errors showing in Sentry dashboard
- Missing performance data

**Solutions:**
```bash
# Verify DSN is set
echo $SENTRY_DSN

# Check Sentry initialization
# Look for "Sentry initialized" in application logs

# Test error capture
curl -X POST http://localhost:3001/api/test-error

# Verify network connectivity
curl https://sentry.io/api/0/projects/

# Check sample rates
echo $SENTRY_TRACES_SAMPLE_RATE
```

### Performance Tuning

#### Prometheus

```yaml
# Optimize scrape intervals
scrape_configs:
  - job_name: 'high-priority'
    scrape_interval: 15s  # More frequent for critical metrics
  - job_name: 'low-priority'
    scrape_interval: 60s  # Less frequent for non-critical

# Reduce retention
storage:
  tsdb:
    retention.time: 7d
    retention.size: 5GB
```

#### Grafana

```yaml
# Enable query caching
[caching]
enabled = true

# Adjust query timeout
[dataproxy]
timeout = 30
```

### Debug Commands

```bash
# View Prometheus configuration
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Check AlertManager routing
docker exec alertmanager amtool config routes show

# Test Prometheus queries
curl 'http://localhost:9090/api/v1/query?query=up'

# View AlertManager silences
docker exec alertmanager amtool silence query

# Check Grafana logs
docker logs grafana | tail -100

# Validate alert rules syntax
docker exec prometheus promtool check rules /etc/prometheus/alerting-rules.yml

# Test webhook endpoints
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"status":"firing","alerts":[{"labels":{"alertname":"test"}}]}' \
  http://localhost:9093/api/v1/alerts
```

### Support Resources

- **Prometheus Documentation**: [prometheus.io/docs](https://prometheus.io/docs)
- **Grafana Documentation**: [grafana.com/docs](https://grafana.com/docs)
- **Sentry Documentation**: [docs.sentry.io](https://docs.sentry.io)
- **AlertManager Documentation**: [prometheus.io/docs/alerting](https://prometheus.io/docs/alerting)
- **BandHub Team**: [slack://bandhub-team](slack://bandhub-team)

### Escalation Path

1. **Level 1**: Check runbook for specific alert
2. **Level 2**: Review logs and metrics in Grafana
3. **Level 3**: Contact on-call engineer via PagerDuty
4. **Level 4**: Create incident and notify team in #incidents Slack channel
5. **Level 5**: Escalate to engineering manager

## Next Steps

After completing this setup:

1. ✅ Verify all dashboards are displaying data
2. ✅ Test alert firing by triggering test conditions
3. ✅ Confirm PagerDuty and Slack notifications work
4. ✅ Set up runbooks for each alert type
5. ✅ Schedule monitoring review meetings
6. ✅ Document incident response procedures
7. ✅ Train team on monitoring tools
8. ✅ Set up synthetic monitoring for critical user flows
9. ✅ Configure log aggregation (if not already done)
10. ✅ Review and tune alert thresholds based on baseline metrics
