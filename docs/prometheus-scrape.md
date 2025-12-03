Prometheus scrape config (prometheus.yml snippet):

scrape_configs:
  - job_name: 'bandhub-api'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['bandhub-api:3001']

Notes:
- In Kubernetes, prefer a ServiceMonitor (Prometheus Operator) or pod annotations to discover endpoints.
- Ensure `/api/metrics` is accessible only to Prometheus or internal network (don't publicly expose metrics).