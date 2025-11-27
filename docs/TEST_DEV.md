# Testing Strategy

This repo now ships with a multi-layered test harness covering backend unit/integration, frontend component/hook tests, and Playwright end-to-end coverage. Key entry points:

- **Backend unit tests** live in `apps/api/test/unit` and rely on lightweight factories in `apps/api/test/helpers` plus the shared Jest setup in `apps/api/test/setup.ts`.
- **Backend integration tests** (Nest controllers with mocked guards/services) reside in `apps/api/test/integration`.
- **Frontend unit tests** run via Jest + React Testing Library in `apps/web/src/**/__tests__`.
- **E2E tests** run with Playwright from `apps/web/e2e` using `apps/web/playwright.config.ts`.
- **Coverage** thresholds are enforced in `apps/api/jest.config.ts` and `apps/web/jest.config.ts` (80% global targets).

## Running tests locally

```bash
# Backend
npm run build:shared
npm run test -- --filter=@hbcu-band-hub/api

# Frontend component + hooks
npm run test -- --filter=@hbcu-band-hub/web -- --runInBand

# Web E2E (requires running Next.js dev server on :3000)
npm run test:e2e -- --filter=@hbcu-band-hub/web
```

Set `DATABASE_URL` to a test instance (defaults are defined in `apps/api/test/setup.ts`).
