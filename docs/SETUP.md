# Setup & Deployment Guide

Complete guide for setting up and deploying the HBCU Band Hub platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Docker Deployment](#docker-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Doppler Integration](#doppler-integration)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd BandHub

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start PostgreSQL and Redis
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Run migrations
npx prisma migrate dev

# Start development servers
npm run dev:api    # Terminal 1 - http://localhost:3001
npm run dev:web    # Terminal 2 - http://localhost:3000
npm run dev:worker # Terminal 3
```

---

## Prerequisites

### Required Software

- **Node.js**: v18 or higher
- **PostgreSQL**: v16 or higher
- **Docker Desktop**: Latest version
- **Git**: Latest version

### Optional Tools

- **VS Code**: With Prisma extension
- **Postman** or **Insomnia**: For API testing
- **Doppler CLI**: For secrets management

---

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url>
cd BandHub
npm install
```

### 2. Configure Environment

Create `.env` in root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/hbcu_band_hub?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# API Configuration
API_PORT="3001"
API_URL="http://localhost:3001"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Environment
NODE_ENV="development"

# YouTube API
YOUTUBE_API_KEY="your_youtube_api_key"
YOUTUBE_QUOTA_LIMIT="10000"

# Worker
WORKER_CONCURRENCY="3"
MAX_YOUTUBE_CALLS_PER_MINUTE="60"

# Auth (generate with: openssl rand -hex 32)
JWT_SECRET="your_jwt_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
```

### 3. Start Services

```bash
# Start PostgreSQL
docker run -d --name postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hbcu_band_hub \
  postgres:15-alpine

# Start Redis
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 4. Run Migrations

```bash
cd packages/database
npx prisma migrate dev
npx prisma generate
```

### 5. Seed Database (Optional)

```bash
npm run seed
```

### 6. Start Development Servers

```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Web
npm run dev:web

# Terminal 3 - Worker
npm run dev:worker
```

---

## Docker Deployment

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Nginx     │────▶│  Next.js Web │     │  NestJS API   │
│   :80,:443  │     │    :3000     │────▶│     :3001     │
└─────────────┘     └──────────────┘     └───────────────┘
                                                 │
                    ┌────────────────────────────┼────────────┐
                    │                            │            │
                    ▼                            ▼            ▼
         ┌──────────────┐          ┌──────────────┐   ┌──────────┐
         │  PostgreSQL  │          │    Redis     │   │  Worker  │
         │    :5432     │          │    :6379     │   └──────────┘
         └──────────────┘          └──────────────┘
```

### Quick Start with Docker Compose

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d

# With monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache & queue |
| api | 3001 | NestJS backend API |
| web | 3000 | Next.js frontend |
| worker | - | Background job processor |
| nginx | 80, 443 | Reverse proxy (production) |

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: hbcu_band_hub
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/hbcu_band_hub
      REDIS_HOST: redis
      REDIS_PORT: 6379
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
      NODE_ENV: production
    depends_on:
      - api

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/hbcu_band_hub
      REDIS_HOST: redis
      REDIS_PORT: 6379
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
```

---

## Environment Configuration

### Environment Files

- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

### Required Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""  # Optional

# API
API_PORT="3001"
API_URL="http://localhost:3001"
PORT="3001"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Environment
NODE_ENV="development|staging|production"

# YouTube API
YOUTUBE_API_KEY="your_key"
YOUTUBE_QUOTA_LIMIT="10000"

# Worker
WORKER_CONCURRENCY="3"
MAX_YOUTUBE_CALLS_PER_MINUTE="60"

# Authentication
JWT_SECRET="min-32-characters"
JWT_REFRESH_SECRET="min-32-characters"
JWT_ACCESS_EXPIRY="7d"
JWT_REFRESH_EXPIRY="30d"

# Security
SECURE_COOKIES="false|true"
CORS_ORIGINS="http://localhost:3000"

# Monitoring (Optional)
SENTRY_DSN="https://..."
SENTRY_TRACES_SAMPLE_RATE="1.0"
```

---

## Database Setup

### Create Database

```sql
-- Connect to PostgreSQL
psql -U postgres -h localhost

-- Create database
CREATE DATABASE hbcu_band_hub;

-- Create user (optional)
CREATE USER bandhub WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE hbcu_band_hub TO bandhub;

-- Exit
\q
```

### Run Migrations

```bash
cd packages/database
npx prisma migrate dev
npx prisma generate
```

### Seed Data

```bash
npm run seed
```

This creates:
- 35+ HBCU bands
- 100+ videos
- Categories
- Sample users

---

## Doppler Integration

Doppler provides centralized secrets management with versioning and audit logs.

### 1. Install Doppler CLI

```bash
# macOS
brew install dopplerhq/cli/doppler

# Windows
scoop install doppler

# Linux
curl -Ls https://cli.doppler.com/install.sh | sh
```

### 2. Login and Setup

```bash
# Login
doppler login

# Navigate to project
cd BandHub

# Setup Doppler
doppler setup

# Select project and config
# Project: bandhub
# Config: dev (for local), staging, or production
```

### 3. Configure Environment

```bash
# Set environment variable
SECRETS_PROVIDER=doppler
DOPPLER_TOKEN=<your-token>
DOPPLER_PROJECT=bandhub
DOPPLER_CONFIG=dev
```

### 4. Run with Doppler

```bash
# Run API with Doppler
doppler run -- npm run dev:api

# Run all services
doppler run -- npm run dev
```

### 5. CI/CD Integration

```bash
# Generate service token
doppler configs tokens create production --name "ci-cd-token"

# Use in CI/CD
export DOPPLER_TOKEN=dp.st.xxx
doppler run -- npm run build
```

### Rollback Procedures

If Doppler becomes unavailable:

1. **Use Fallback**: Application automatically falls back to environment variables

2. **Switch Provider**:
   ```env
   SECRETS_PROVIDER=env
   ```

3. **Emergency Access**:
   ```bash
   # Export secrets to .env
   doppler secrets download --no-file --format env > .env
   ```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations up to date
- [ ] SSL/TLS certificates ready
- [ ] Monitoring stack configured
- [ ] Backup procedures tested
- [ ] Health checks verified
- [ ] Rate limiting configured
- [ ] Security headers enabled

### Deployment Steps

1. **Build Applications**
   ```bash
   npm run build
   ```

2. **Run Database Migrations**
   ```bash
   npx prisma migrate deploy
   ```

3. **Start Services**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Verify Health**
   ```bash
   curl http://localhost:3001/api/health
   ```

5. **Monitor Logs**
   ```bash
   docker compose logs -f api
   ```

### SSL/TLS Configuration

#### Using Let's Encrypt

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Generate certificate
certbot --nginx -d api.hbcubandhub.com -d hbcubandhub.com

# Auto-renewal
certbot renew --dry-run
```

#### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.hbcubandhub.com;

    ssl_certificate /etc/letsencrypt/live/api.hbcubandhub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hbcubandhub.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://api:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -U postgres -h localhost -d hbcu_band_hub

# Check logs
docker logs postgres

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Test connection
docker exec -it redis redis-cli ping
# Should return: PONG

# Check logs
docker logs redis
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Migration Errors

```bash
# Reset database (development only!)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Check migration status
npx prisma migrate status
```

### Docker Issues

```bash
# Rebuild containers
docker compose build --no-cache

# Remove volumes and restart
docker compose down -v
docker compose up -d

# Check container logs
docker compose logs -f <service-name>

# Shell into container
docker compose exec api sh
```

---

## Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:api          # Start API only
npm run dev:web          # Start web only
npm run dev:worker       # Start worker only

# Building
npm run build            # Build all
npm run build:api        # Build API
npm run build:web        # Build web

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Testing
npm run test            # Run all tests
npm run test:e2e        # End-to-end tests
npm run test:watch      # Watch mode

# Linting
npm run lint            # Lint all code
npm run lint:fix        # Fix linting issues

# Docker
npm run docker:up       # Start Docker services
npm run docker:down     # Stop Docker services
npm run docker:logs     # View Docker logs
```

---

## Additional Resources

- **API Documentation**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/health
- **Prisma Studio**: http://localhost:5555
- **Grafana**: http://localhost:3000 (monitoring stack)
- **GitHub**: https://github.com/JFenderson/BandHub
