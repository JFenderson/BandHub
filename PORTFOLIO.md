# BandHub

A video discovery platform for HBCU marching band performances that aggregates and auto-categorizes YouTube content across 100+ band and creator channels, built for fans, alumni, and band programs.

## Problem

HBCU marching band footage is scattered across dozens of independent YouTube channels run by bands, halftime-show creators, and fan accounts, with no central place to browse by school, category (stand battles, halftime, drumline features, etc.), or event. Fans previously had to know which channels to follow and manually sift uploads; there was no way to discover a specific band's content, compare bands, or get notified of new uploads in one place. BandHub solves this by syncing YouTube nightly, using an AI classifier to figure out which band and category each video belongs to, and exposing that as a searchable, filterable library with per-band pages, playlists, and favorites.

## Tech Stack

**Frontend**
- Next.js 14 (App Router), React 18, TypeScript
- Framer Motion, `@dnd-kit` (drag-and-drop, e.g. playlist reordering)
- PWA support (`apps/web/src/app/offline`, service worker/manifest assets)
- Playwright for E2E tests

**Backend**
- NestJS 11 (REST API), TypeScript
- Prisma 5 ORM over PostgreSQL (54-model schema)
- BullMQ (Redis-backed job queues) + `@nestjs/schedule` cron jobs
- Passport JWT auth, TOTP-based MFA, magic links, OAuth
- Anthropic Claude SDK (`@anthropic-ai/sdk`) for AI-assisted video classification
- `opossum` circuit breaker around external calls (YouTube/Claude APIs)

**Database**
- PostgreSQL via Prisma, with a dedicated `packages/database` workspace package and versioned migrations

**Infra / Observability**
- Docker Compose (Postgres, Redis, api, web, worker, nginx) with separate prod/test/monitoring compose files
- Prometheus + Grafana + alerting rules; OpenTelemetry SDK/auto-instrumentation with OTLP export
- Sentry (Node + Next.js) for error tracking
- Doppler for secrets management; a JWT key-rotation script (`rotate:jwt`)
- GitHub Actions: `tests.yml`, `deploy-staging.yml`, `deploy-production.yml` (manual-gated), `monitoring-test.yml`
- Turborepo + npm workspaces monorepo (`apps/`, `packages/`, `libs/`)

**Notable libraries**
- `googleapis` (YouTube Data API), `ioredis`, `pino`/`pino-http` structured logging, `prom-client` metrics, `@aws-sdk/client-ses` for email

## Architecture

BandHub is a three-service monorepo: a Next.js web client, a NestJS API, and a separate NestJS **worker** process, sharing Prisma models (`packages/database`), a Redis cache/queue layer (`packages/cache`), shared types (`libs/shared`), and an OpenTelemetry wrapper (`libs/observability`).

The worker is the core data pipeline. On a nightly cron (`EVERY_DAY_AT_3AM`), it pulls new uploads from 100+ YouTube channels via the YouTube Data API, then classifies and matches each video to a band through a **three-stage cascade** (`apps/worker/src/processors/match-videos.processor.ts`):
1. **Stage 0 – Channel ownership pre-filter**: if the uploading channel is already mapped 1:1 to a known band, match immediately at high confidence, skipping the AI call entirely (cost/latency optimization).
2. **Stage 1 – AI primary path**: an internal "band librarian" service (`band-librarian.service.ts`) sends video titles/metadata to Claude in batches (`classifyBatch`, documented as "5x fewer API calls" than per-video calls) and parses a structured JSON extraction (band ID, category, confidence 0–100).
3. **Stage 2 – Enhanced alias fallback**: if AI confidence is below a tuned minimum threshold (raised from 30 to 50 per a code comment, after false-positive matches were observed in production), the pipeline falls back to alias/string matching against known band name variants before giving up and flagging the video `low_confidence`/`no_match`.

Matched videos flow through further BullMQ-driven processors (`promote-videos`, `classify-videos`, `trending-metrics`, `cleanup`) on their own queues (`YOUTUBE_SYNC`, `VIDEO_PROCESSING`, `MAINTENANCE`), so sync, classification, and promotion are decoupled and independently retryable/observable via a Bull Board-style admin queue view.

Auth is JWT-based with a dedicated `jwt-rotation.service.ts` and a `JwtKey` Prisma model (versioned, `isActive`/`isPrimary` flags) so signing keys can be rotated without invalidating all existing sessions — a deliberate choice over a single static secret, evidenced by the `rotate:jwt` script and key-rotation-aware verification. MFA uses standard TOTP (RFC 6238, 30s period, 6 digits, SHA-256) rather than SMS. Sessions, refresh tokens, device fingerprinting, and security-event logging are separate concerns/services rather than bolted into `auth.service.ts`, which suggests the auth surface grew incrementally and was refactored into single-responsibility services.

A diagram worth drawing: **YouTube channels → worker sync cron → BullMQ queues → three-stage match cascade (channel pre-filter → Claude classification → alias fallback) → Postgres (Video/Band/VideoBand) → cache layer → NestJS API → Next.js client**, with Prometheus/OTel spans attached at the queue and matching boundaries.

## Key Technical Challenges

- **Reducing false-positive band matches without losing recall.** The commit history shows several dedicated passes on this ("Enhance band matching: three-stage cascade, multi-band support, rematch infrastructure," confidence threshold raised from 30→50). The fix wasn't a single algorithm change but a layered pipeline (ownership pre-filter → AI → alias fallback) plus a separate `rematch-videos.processor.ts` and admin "recategorize" actions to correct historically mismatched videos rather than requiring a full re-sync.
- **Cost-bounded AI classification at scale.** Classifying every video individually against an LLM doesn't scale to nightly syncs of 100+ channels. `classifyBatch()` batches multiple videos per Claude call, and Stage 0's channel-ownership shortcut skips the AI call entirely for known-owned channels, cutting API usage before it happens rather than caching after the fact.
- **Multi-band videos and category drift.** The schema has a `VideoBand` join model (a video can belong to multiple bands) that only appears in the "multi-band support" commit, indicating the original design assumed a 1:1 video→band relationship and had to be migrated to many-to-many after real data violated that assumption — evidenced by companion admin tooling (`hide-excluded`, `recategorize-other` actions) built to clean up the resulting backlog.
- **Race conditions in the promotion pipeline.** Commit `551f641 "Fix promote-videos race condition and wrong category slugs"` indicates concurrent BullMQ workers were double-promoting or mis-slugging videos; the queue/processor separation (dedicated `promote-videos.processor.ts`) plus this fix implies job-level locking/idempotency was added after the bug surfaced in production, not designed in up front.
- **JWT key rotation without breaking active sessions.** Rather than a single long-lived secret, the `JwtKey` model tracks versioned keys with `isActive`/`isPrimary` flags so old tokens signed by a rotated-out key can still be validated during a grace period — evidenced by `jwt-rotation.service.ts` and the vulnerability-fix commit (`6e5ec8d "vulnerabiliy fixes"`) suggesting this was hardened in response to a specific security review.

## Notable Features

- AI-assisted, confidence-scored video-to-band classification pipeline (not manual tagging)
- Multi-band video support with admin recategorization tools
- TOTP-based MFA, magic-link login, and OAuth alongside standard JWT auth
- JWT signing-key rotation with grace-period validation
- Device fingerprinting and security-event/audit logging (`security-audit.service.ts`, `SecurityEvent` model)
- Redis-backed caching with tagging, compression, and warming strategies (`packages/cache`), not just a flat TTL cache
- Trending-videos metrics job (hourly cron) and a recommendations module
- Achievements/points gamification (`Achievement`, `UserPoints`, `UserAchievement` models)
- Playlists with collaborators, followers, and sharing (drag-and-drop reordering via `@dnd-kit`)
- PWA support with an offline route
- Full observability stack: OpenTelemetry tracing, Prometheus metrics, Grafana dashboards + alerting rules, Sentry error tracking — configured for a side project, not just `console.log`

## Impact / Usage

Usage data not available in repo — [ASK USER] (e.g. number of registered users, monthly active users, total videos indexed, number of bands/channels synced in production, uptime).

## Code Quality Signals

- **History**: 436 commits showing steady iterative development with real production-fix commits (`"PROD FIX"`, `"Fix promote-videos race condition"`, `"vulnerabiliy fixes"`, `"Fix deploy: export Doppler secrets..."`) — this reads as a live, operated system that got debugged under real usage, not a one-shot build.
- **Tests**: 24 backend unit/integration spec files covering auth, sessions, security audit, YouTube sync, bands, and video services; a Playwright E2E suite on the frontend covering admin auth and video browsing flows. No visible coverage numbers/thresholds enforced in CI configs reviewed.
- **CI/CD**: GitHub Actions with a dedicated `tests.yml`, separate `deploy-staging.yml` (auto) and `deploy-production.yml` (manual-gated), plus a `monitoring-test.yml` — a real staged deployment process, not push-to-prod.
- **Documentation**: CLAUDE.md provides command references; in-code comments are sparse but present at genuinely non-obvious decision points (e.g. the confidence-threshold rationale, the batching efficiency note), which is a good signal — comments explain *why*, not *what*.

## One-Line Resume Bullet

Built a NestJS/Next.js video platform that nightly syncs 100+ YouTube channels through a BullMQ pipeline and a three-stage (channel pre-filter → Claude-based classification → alias fallback) matching cascade to auto-categorize marching band videos, cutting per-video AI calls via batch classification and channel-ownership short-circuiting.
