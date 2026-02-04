**Health Runbook (draft)**

- **On-call receives alert**: Identify which alert fired (CPU, DB, Redis, queue backlog, external API failures).
- **Initial triage (1-5 min)**:
  - Check Grafana dashboard for trends (errors, request rate, latency).
  - Check `/api/health/ready` and `/api/health/queues` endpoints.
  - Run `kubectl get pods -n <ns>` and `kubectl logs <pod>` for recent errors.
- **Database issues**:
  - Check PG active/idle connections from `/api/health/database`.
  - If connections saturated, consider scaling app replicas down/up, or increasing PG max_connections.
  - If long-running queries, identify with `pg_stat_activity` and cancel if needed.
- **Redis issues**:
  - Check memory usage, evicted keys, and hit rate from `/api/health/cache`.
  - If memory pressure, evict large keys or scale Redis (add replicas/shard/resize).
- **Queue backlog**:
  - Inspect `/api/health/queues` for waiting/active/failed counts.
  - If backlog increasing, scale workers up or investigate failing jobs.
- **External API failures (YouTube)**:
  - Check `/api/health/external/youtube` response time and status.
  - If YouTube quota exhausted, enable circuit breaker and follow outage policy; report to status page.
- **Mitigation steps**:
  - Enable maintenance mode: pause queues and stop non-critical jobs.
  - Roll back recent deployments if rollout introduced regressions.
  - Increase replicas or vertical scale temporarily if capacity issue.
- **Post-incident**:
  - Create post-mortem with timeline, root cause, and action items.
  - Add monitoring or alerts for missing metrics identified during incident.

Contact: Platform team, DBA, and owner of the sync workers.
