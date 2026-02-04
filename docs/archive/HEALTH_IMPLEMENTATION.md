**Health & Monitoring Implementation — Summary**

This document summarizes the recent health, monitoring, and resiliency work applied to the BandHub repository. It lists what was added, where to find the changes, how to run the worker to validate the circuit-breaker, and next steps.

**Overview**
- **Purpose:** Improve observability and operational safety by adding Prometheus metrics, detailed health checks (readiness vs liveness), graceful shutdown, and a circuit breaker around external YouTube API calls in the worker.
- **Scope:** Changes were applied primarily to the `apps/api` (metrics, health endpoints, graceful shutdown) and `apps/worker` (circuit breaker wiring) subprojects.

**What Was Done (high level)**
- **Prometheus metrics (API):** Added a Prometheus registry, HTTP interceptor, and `/api/metrics` endpoint to capture HTTP request durations, active connections, and business counters.
  - Files: `apps/api/src/metrics/metrics.service.ts`, `metrics.interceptor.ts`, `metrics.controller.ts`, `metrics.module.ts`
- **Health checks & probes (API):** Implemented a `HealthService` that performs detailed checks against PostgreSQL (via `pg_stat_activity`), Redis (`INFO`), and BullMQ queues, plus lightweight external API probes. Readiness and liveness endpoints were added.
  - Files: `apps/api/src/health/health.service.ts`, `health.controller.ts`, `health.module.ts`
- **Graceful shutdown (API):** Bootstrap updated to enable shutdown hooks and to pause/drain queues and close Prisma/Redis on SIGTERM/SIGINT.
  - File: `apps/api/src/main.ts`
- **Circuit breaker (worker):** Added an `opossum`-based `CircuitBreakerService` and wrapped low-level YouTube network calls in the worker (`search.list`, `videos.list`, `channels.list`, `playlistItems.list`) to prevent prolonged failures from cascading.
  - Files: `apps/worker/package.json` (added dependency), `apps/worker/src/external/circuit-breaker.service.ts`, `apps/worker/src/services/youtube.service.ts`, `apps/worker/src/worker.module.ts`
- **Status reporting & runbook:** Drafted a status reporting placeholder service and a runbook + Grafana dashboard draft under `docs/` for operators.
  - Files: `apps/api/src/status/status.service.ts`, `docs/HEALTH_RUNBOOK.md`, `docs/health-grafana.json`

**Why these changes**
- Prevent noisy/heavy external API failures (YouTube) from blocking workers permanently.
- Provide clear readiness/liveness semantics so orchestrators (Docker / Kubernetes) can restart unhealthy services.
- Expose runtime metrics to Prometheus for alerting and dashboards.

**Quick validation steps**
1. Install worker dependencies and build (from repository root):

```bash
cd apps/worker
npm install
npm run build
```

2. Start the worker (dev):

```bash
npm run dev
```

3. Trigger a worker job that calls YouTube (e.g., enqueue a sync job) and watch the worker logs for messages like `circuit youtube.search.list opened` or `circuit youtube.videos.list opened` which indicate the breaker opened.

4. The API metrics endpoint is at: `http://<api-host>:<api-port>/api/metrics` (Prometheus scrapeable text format).

**Important implementation notes**
- The worker uses a per-call `opossum` breaker (simple pattern) with safe defaults: `timeout: 10000`, `errorThresholdPercentage: 50`, `resetTimeout: 30000`.
- The worker's existing internal rate-limiter (sliding-window, `MAX_CALLS_PER_MINUTE`) and BullMQ job retry/backoff remain active. The breaker is configured to *not* perform additional retries so the existing backoff/attempts behavior is preserved.
- Docker healthchecks were switched to the readiness endpoint for the API to avoid restarting containers that are alive but not ready.

**Files to review / important entry points**
- API metrics: `apps/api/src/metrics/metrics.controller.ts`
- API health & probes: `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.service.ts`
- Worker breaker: `apps/worker/src/external/circuit-breaker.service.ts`
- Worker YouTube client: `apps/worker/src/services/youtube.service.ts`

**Pending / Recommended next steps**
- Export more numeric gauges to Prometheus (DB active connections, Redis memory, Bull queue counts) from either the API or from a small worker metrics exporter. (TODO: add Prometheus gauges and update `apps/api` metrics service.)
- Add worker-side `/metrics` or push worker metrics to the API for centralized scraping.
- Create Kubernetes `ServiceMonitor` / `Deployment` probe YAML and import the Grafana dashboard JSON into Grafana for visualization.
- Consider pooled (per-endpoint) circuit breakers for lower allocation overhead if the per-call breaker pattern shows CPU/GC pressure.

If you'd like, I can now:
- Run `npm install` and `npm run build` for the worker and attempt to start it locally, checking for type errors.
- Add `prom-client` to the worker and expose a `/metrics` endpoint.
- Produce the example Kubernetes `readiness`/`liveness` YAML and a `ServiceMonitor` snippet.

— End of summary
