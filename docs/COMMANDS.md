# HBCU Band Hub - Commands Reference

This file contains all the commands you'll need for developing, testing, and deploying the HBCU Band Hub application.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Daily Development](#daily-development)
3. [Database Commands](#database-commands)
4. [Building & Production](#building--production)
5. [Testing](#testing)
6. [Code Quality](#code-quality)
7. [Docker & Infrastructure](#docker--infrastructure)
8. [Troubleshooting](#troubleshooting)

---

## Initial Setup

These commands are run once when you first clone the project or set up a new development environment.

### Prerequisites

Before starting, ensure you have these installed:

```bash
# Check Node.js version (requires 20+)
node --version

# Check npm version
npm --version

# Check Docker (for local Redis/PostgreSQL)
docker --version
docker compose version
```

### One-Time Setup

```bash
# Install all dependencies for the monorepo
npm install

# Generate Prisma client (creates TypeScript types from your schema)
npm run db:generate

# Run database migrations (creates/updates tables in PostgreSQL)
npm run db:migrate

# Seed the database with initial data (categories, sample bands, etc.)
npm run db:seed

# Or run all setup steps at once
npm run setup
```

**What each command does:**

- `npm install` - Installs dependencies for root, apps/api, apps/web, and libs/shared
- `db:generate` - Creates the Prisma Client with TypeScript types matching your schema
- `db:migrate` - Applies all pending migrations to your database
- `db:seed` - Populates initial data (categories, sample data for testing)

---

## Daily Development

Commands you'll use every day while building features.

### Starting Development Servers

```bash
# Start all apps in development mode (recommended)
# This starts both frontend (Next.js) and backend (NestJS) with hot reload
npm run dev

# Start only the API (NestJS backend)
npm run dev -w apps/api

# Start only the Web app (Next.js frontend)
npm run dev -w apps/web

# Start only the worker (background jobs)
npm run dev -w apps/worker
```

**Ports (default):**

- Frontend (Next.js): http://localhost:3000
- Backend (NestJS): http://localhost:3001
- Prisma Studio: http://localhost:5555

### Viewing Database

```bash
# Open Prisma Studio - visual database browser
npm run db:studio
```

This opens a web UI where you can browse and edit your database records directly. Very helpful for debugging.

---

## Database Commands

Managing your PostgreSQL database with Prisma.

### Migrations

```bash
# Create a new migration after changing schema.prisma
npm run db:migrate

# Apply migrations without creating new ones (for CI/CD)
npx prisma migrate deploy

# Reset database (drops all data, re-runs migrations and seed)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Schema Operations

```bash
# Regenerate Prisma Client after schema changes
npm run db:generate

# Push schema changes directly (skip migration files - dev only)
npm run db:push

# Format the schema.prisma file
npx prisma format

# Validate the schema.prisma file
npx prisma validate
```

### Data Operations

```bash
# Seed the database with initial data
npm run db:seed

# Pull schema from existing database (reverse engineering)
npx prisma db pull

# Execute raw SQL
npx prisma db execute --file ./path/to/script.sql
```

### Workflow: Making Schema Changes

When you modify `prisma/schema.prisma`:

```bash
# 1. Make your changes to prisma/schema.prisma

# 2. Create a migration with a descriptive name
npx prisma migrate dev --name add_video_views_count

# 3. Verify the migration was applied
npx prisma migrate status
```

---

## Building & Production

Commands for building and running production builds.

### Building

```bash
# Build all apps for production
npm run build

# Build specific app
npm run build -w apps/api
npm run build -w apps/web

# Build the shared library (often needed before building apps)
npm run build -w @hbcu-band-hub/shared
```

### Running Production Builds

```bash
# Start all apps in production mode
npm run start

# Start specific app
npm run start -w apps/api
npm run start -w apps/web
```

### Environment Variables

```bash
# Copy example env file (do this once)
cp .env.example .env

# Required variables in .env:
# DATABASE_URL="postgresql://user:password@localhost:5432/hbcu_band_hub"
# REDIS_URL="redis://localhost:6379"
# YOUTUBE_API_KEY="your-api-key"
# NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## Testing

Commands for running tests.

### Unit Tests

```bash
# Run all tests
npm run test

# Run tests for specific app
npm run test -w apps/api
npm run test -w apps/web

# Run tests in watch mode
npm run test -w apps/api -- --watch

# Run tests with coverage
npm run test -w apps/api -- --coverage
```

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests for specific app
npm run test:e2e -w apps/api
```

### Testing Specific Files

```bash
# Run tests matching a pattern
npm run test -w apps/api -- --testPathPattern=bands

# Run a specific test file
npm run test -w apps/api -- src/modules/bands/bands.service.spec.ts
```

---

## Code Quality

Linting, formatting, and type checking.

### Linting

```bash
# Lint all apps
npm run lint

# Lint specific app
npm run lint -w apps/api
npm run lint -w apps/web

# Lint and auto-fix issues
npm run lint -w apps/api -- --fix
```

### Formatting

```bash
# Format all files with Prettier
npx prettier --write .

# Check formatting without changing files
npx prettier --check .

# Format specific directory
npx prettier --write "apps/api/src/**/*.ts"
```

### Type Checking

```bash
# Check TypeScript types (no emit)
npx tsc --noEmit

# Check specific app
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

---

## Docker & Infrastructure

Commands for local infrastructure and containerization.

### Local Development Infrastructure

```bash
# Start PostgreSQL and Redis containers
docker compose up -d

# Stop containers
docker compose down

# Stop and remove volumes (clears all data)
docker compose down -v

# View container logs
docker compose logs -f

# View specific service logs
docker compose logs -f postgres
docker compose logs -f redis
```

### Docker Build (for deployment)

```bash
# Build API Docker image
docker build -f apps/api/Dockerfile -t hbcu-band-hub-api .

# Build Web Docker image
docker build -f apps/web/Dockerfile -t hbcu-band-hub-web .

# Run API container locally
docker run -p 3001:3001 --env-file .env hbcu-band-hub-api
```

### Redis CLI

```bash
# Connect to Redis CLI
docker exec -it hbcu-band-hub-redis redis-cli

# Common Redis commands once connected:
# KEYS *              - List all keys
# GET key_name        - Get a value
# FLUSHALL            - Clear all data
# INFO                - Server info
```

### PostgreSQL CLI

```bash
# Connect to PostgreSQL
docker exec -it hbcu-band-hub-postgres psql -U postgres -d hbcu_band_hub

# Common psql commands once connected:
# \dt                 - List tables
# \d table_name       - Describe table
# \q                  - Quit
```

---

## Troubleshooting

Commands to help when things go wrong.

### Clean Rebuild

```bash
# Remove all node_modules and build artifacts
npm run clean

# Fresh install
npm install

# Regenerate Prisma client
npm run db:generate
```

### Clear Caches

```bash
# Clear Turbo cache
npx turbo clean

# Clear Next.js cache
rm -rf apps/web/.next

# Clear NestJS build
rm -rf apps/api/dist

# Clear all caches
npm run clean && rm -rf .turbo
```

### Reset Database

```bash
# Full database reset (drops all data!)
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Apply all migrations
# 4. Run the seed script
```

### Dependency Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete lock file and reinstall
rm package-lock.json
npm install

# Update all dependencies
npm update

# Check for outdated packages
npm outdated
```

### Prisma Issues

```bash
# Regenerate Prisma Client
npx prisma generate

# If migrations are out of sync
npx prisma migrate resolve --rolled-back "migration_name"

# View current migration state
npx prisma migrate status
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process on port 3000
kill -9 $(lsof -t -i:3000)

# Or use npx
npx kill-port 3000 3001
```

---

## Quick Reference

### Most Common Commands

| Task | Command |
|------|---------|
| Start development | `npm run dev` |
| View database | `npm run db:studio` |
| Run migrations | `npm run db:migrate` |
| Build for production | `npm run build` |
| Run tests | `npm run test` |
| Lint code | `npm run lint` |
| Start infrastructure | `docker compose up -d` |
| Full reset | `npm run clean && npm run setup` |

### Workspace Shorthand

The `-w` flag targets a specific workspace:

```bash
npm run <script> -w apps/api      # NestJS backend
npm run <script> -w apps/web      # Next.js frontend
npm run <script> -w apps/worker   # Background jobs
npm run <script> -w @hbcu-band-hub/shared  # Shared library
```

---

## Next Steps

After initial setup, your typical workflow will be:

1. `docker compose up -d` - Start PostgreSQL and Redis
2. `npm run dev` - Start development servers
3. Make code changes (hot reload handles the rest)
4. `npm run db:studio` - Check database as needed
5. `npm run test` - Run tests before committing
6. `npm run lint` - Check code quality

---

*Last updated: November 2024*