# BandHub Observability

This folder captures runtime instrumentation details for the API, web, and worker services. All signals emit correlation-aware metadata so incidents can be reconstructed end-to-end.

## Components
- **Logging**: Structured JSON logs via Pino with `x-correlation-id` propagation.
- **Tracing**: OpenTelemetry NodeSDK exporting OTLP spans (B3 propagation).
- **Error tracking**: Sentry (server and browser) with release + environment tags.
- **Metrics**: Prometheus counters/histograms/gauges for API latency, DB queries, Redis cache efficiency, YouTube quota, auth events, job throughput, and featured band clicks.
- **Dashboards**: Grafana JSON definitions for platform and business KPIs.
- **Alerts**: Prometheus-compatible alerting rules for availability, latency, and quota anomalies.

### Quickstart
1. Configure environment variables:
   - `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`
   - `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `RELEASE`
   - `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_RELEASE`
   - `LOG_LEVEL`
2. Run services with the `@hbcu-band-hub/observability` library imported in API, web, and worker.
3. Scrape metrics from `api/metrics` and expose OTLP traces to your collector.
4. Import Grafana dashboards from `dashboards/*.json`.
5. Load alerting rules into Prometheus or Alertmanager via `alerts/*.yml`.

### Debugging Playbook
- Search logs by `correlationId` to connect frontend, API, worker, DB, and cache events.
- Use Sentry breadcrumbs to reconstruct user actions; correlate with spans using the same correlation ID tag.
- Inspect Grafana panels for spikes in latency (p50/p95/p99), database slow queries, Redis miss bursts, or YouTube quota exhaustion trends.
- Video sync issues: check `bandhub_video_sync_results_total` and worker queue spans.
- Authentication issues: review `bandhub_auth_events_total` and Sentry user contexts.
- Frontend regressions: use source-mapped Sentry errors with release tags to trace the impacted deployment.
