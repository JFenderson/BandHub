Kubernetes Probe Examples

Readiness probe (use /api/health/ready):

apiVersion: v1
kind: Pod
metadata:
  name: bandhub-api
spec:
  containers:
    - name: api
      image: your-registry/bandhub-api:latest
      ports:
        - containerPort: 3001
      readinessProbe:
        httpGet:
          path: /api/health/ready
          port: 3001
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 3
        failureThreshold: 3
      livenessProbe:
        httpGet:
          path: /api/health/live
          port: 3001
        initialDelaySeconds: 20
        periodSeconds: 20
        timeoutSeconds: 5
        failureThreshold: 6

Notes:
- Readiness checks ensure the app is ready to accept traffic (DB/Redis/queues ok).
- Liveness checks ensure the app process is healthy; keep this lightweight.

Prometheus scrape example (ServiceMonitor or scrape job):
- job_name: 'bandhub-api'
  metrics_path: /api/metrics
  static_configs:
    - targets: ['bandhub-api:3001']
