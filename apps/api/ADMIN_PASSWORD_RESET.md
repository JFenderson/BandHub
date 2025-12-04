# Admin Password Reset (Forgot / Reset) — Implementation Notes

This document describes the backend implementation for the admin "forgot password" / "reset password" flow that was added to the API. It covers database changes, endpoints, security behavior, mail delivery, environment variables, migration instructions, and suggested frontend integration points.

**Status:** Implemented in code; requires Prisma migration, dependency install, and runtime verification.

**Files touched/created**
- `apps/api/prisma/schema.prisma` — added `sessionVersion` to `AdminUser` and a new `AdminPasswordResetToken` model.
- `apps/api/src/modules/auth/dto/forgot-password.dto.ts` — DTO for forgot password request.
- `apps/api/src/modules/auth/dto/reset-password.dto.ts` — DTO for reset password request.
- `apps/api/src/modules/auth/auth.controller.ts` — added `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`.
- `apps/api/src/modules/auth/auth.service.ts` — implemented token creation, hashing, storage, reset flow, and session invalidation via `sessionVersion` increment.
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` — validates `sessionVersion` in JWT payload against DB value to invalidate old tokens.
- `apps/api/src/modules/mailer/mailer.service.ts` & `mailer.module.ts` — AWS SES-based mailer provider.
- `apps/api/src/modules/email/email.service.ts` — added `sendAdminPasswordResetEmail(...)` helper and integrated Mailer fallback logic.

**High-level flow**
- Admin submits email to `/api/auth/forgot-password`.
- Server (AuthService):
  - Looks up admin by email (does not reveal existence to caller).
  - Deletes any previous admin reset tokens for that admin (optional cleanup).
  - Generates a cryptographically-secure token, stores a hashed version in DB (`AdminPasswordResetToken`) with an expiry and `used = false`.
  - Sends an email with a one-time reset URL containing the plain token.
- Admin receives email, opens link (frontend page), and submits `token + newPassword` to `/api/auth/reset-password`.
- Server (AuthService.reset):
  - Hashes provided token and compares with DB record, validates not used and not expired.
  - In a DB transaction: updates admin password hash, increments admin `sessionVersion`, marks the token `used`, and optionally deactivates sessions/refresh tokens.
  - Sends confirmation email (optional) and returns success.

**Security model & rationale**
- Tokens are stored hashed (SHA-256) to prevent token theft from DB dumps.
- Tokens are single-use and time-limited (expiry set on create).
- JWTs include `sessionVersion`; on password reset the DB `sessionVersion` is incremented so any previously-issued JWTs become invalid.
- Forgot-password endpoint returns a generic 200 response for both existing and non-existing emails to avoid account enumeration.

**Database changes (Prisma)**
- `AdminUser` model: added `sessionVersion Int @default(0)`.
- New `AdminPasswordResetToken` model (table: `admin_password_reset_tokens`) with fields:
  - `id` (Int/ID)
  - `token` (string, hashed)
  - `adminUserId` (FK)
  - `expiresAt` (DateTime)
  - `used` (Boolean)
  - `createdAt` (DateTime)

Run a Prisma migration after pulling these changes.

**Endpoints**
- POST `/api/auth/forgot-password`
  - Body: `{ email: string }`
  - Response: generic success message (200) regardless of whether the account exists.
- POST `/api/auth/reset-password`
  - Body: `{ token: string, password: string }`
  - Response: success or generic failure (token invalid/expired).

**Important environment variables**
- `DATABASE_URL` — Postgres connection string used by Prisma.
- `JWT_SECRET` — signing secret for JWTs.
- `APP_URL` — base URL used to build reset link in email (e.g. `https://app.example.com`).
- Email provider options:
  - (Preferred) AWS SES: `AWS_REGION`, plus AWS credentials via environment/role; `SES_FROM_EMAIL` or `EMAIL_FROM` for From address.
  - (Fallback) `RESEND_API_KEY` — if SES is not configured, the EmailService falls back to Resend usage if available.
- Optional: `NODE_ENV`, `LOG_LEVEL`

**Dependencies**
- `@aws-sdk/client-ses` (added to repo `package.json`) — used by the new MailerService.

**Migration & run steps (local dev)**
Open a shell at repo root and run (Windows `cmd.exe` style):

```bat
cd apps\api
npm install
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate dev --schema=prisma/schema.prisma --name add-admin-password-reset
npm run dev
```

Notes:
- If you use `pnpm` at the repo root, run `pnpm install` at repo root instead, then run the Prisma commands from `apps/api` as shown.
- Ensure `DATABASE_URL`, `JWT_SECRET`, and mail env vars are set before running migrations and tests.

**Tests**
- A basic unit test for `MailerService` was added to assert non-SES behavior. Run the API tests with:

```bat
cd apps\api
npm test
```

**Frontend integration ideas (next steps)**
- Add a public `admin/forgot-password` page with a single email input that POSTs to `/api/auth/forgot-password`.
- Add a `admin/reset-password/[token]` page that accepts `token` query param and POSTs `{ token, password }` to `/api/auth/reset-password`.
- On success, redirect to admin login page with a success toast.
- Protect admin routes with existing RBAC checks `SUPER_ADMIN | ADMIN | MODERATOR` both server-side and client-side.

**Operational notes & next steps**
- Run the Prisma migration and tests to validate behavior locally.
- Verify email sending via SES in a staging environment before deploying to production.
- Consider adding background cleanup of expired tokens and an audit log of password-reset events.

If you want, I can now:
- Add the two frontend pages in `apps/web` (forgot + reset) and wire up client API calls, or
- Provide exact CI changes / Prisma migration script to include in your DB deployment pipeline.

---
Generated on: 2025-12-03
