# Docker Infrastructure Documentation

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Services](#services)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [Networking](#networking)
- [Volumes](#volumes)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Internet                                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Nginx (Reverse Proxy)                          │
│                     - SSL Termination                                    │
│                     - Rate Limiting                                      │
│                     - Static File Caching                               │
│                     Ports: 80, 443                                      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│         Web (Next.js)         │  │         API (NestJS)          │
│   - Server-side rendering     │  │   - REST API                  │
│   - Static assets             │  │   - Authentication            │
│   Port: 3000                  │  │   - Business logic            │
└───────────────────────────────┘  │   Port: 3001                  │
                                   └──────────────┬────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐  ┌───────────────────────────────┐
│      PostgreSQL Database      │  │         Redis Cache           │  │      Worker (Background)      │
│   - User data                 │  │   - Session cache             │  │   - YouTube sync              │
│   - Video metadata            │  │   - Job queue (BullMQ)        │  │   - Scheduled tasks           │
│   Port: 5432                  │  │   Port: 6379                  │  │   - Async processing          │
└───────────────────────────────┘  └───────────────────────────────┘  └───────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Make (optional, for convenience commands)

### Development Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/hbcu-band-hub.git
cd hbcu-band-hub

# 2. Create environment file
cp .env.development .env

# 3. Start all services
make start
# OR
docker compose up -d

# 4. Run database migrations
make db-migrate
# OR
docker compose exec api npx prisma migrate deploy

# 5. Seed the database (optional)
make db-seed

# 6. Access the application
# Web: http://localhost:3000
# API: http://localhost:3001
# API Health: http://localhost:3001/api/health
```

---

## Services

### Service Overview

| Service    | Image               | Port(s)    | Description                          |
|------------|---------------------|------------|--------------------------------------|
| postgres   | postgres:15-alpine  | 5432       | Primary database                     |
| redis      | redis:7-alpine      | 6379       | Cache and job queue                  |
| api        | Custom (NestJS)     | 3001       | Backend API server                   |
| web        | Custom (Next.js)    | 3000       | Frontend web application             |
| worker     | Custom (NestJS)     | -          | Background job processor             |
| nginx      | Custom (nginx)      | 80, 443    | Reverse proxy (production)           |
| certbot    | certbot/certbot     | -          | SSL certificate management           |

### Service Details

#### PostgreSQL Database
- **Image**: `postgres:15-alpine`
- **Purpose**: Primary data store
- **Features**:
  - Full-text search support
  - Connection pooling
  - Automatic backups (production)
- **Environment Variables**:
  - `POSTGRES_USER`: Database username
  - `POSTGRES_PASSWORD`: Database password
  - `POSTGRES_DB`: Database name

#### Redis Cache
- **Image**: `redis:7-alpine`
- **Purpose**: Caching and job queue (BullMQ)
- **Features**:
  - Append-only file persistence
  - Memory limit with LRU eviction
  - Password protection (production)

#### API (NestJS)
- **Dockerfile**: `apps/api/Dockerfile`
- **Purpose**: Backend REST API
- **Features**:
  - Multi-stage build for smaller images
  - Prisma ORM integration
  - Health check endpoint
  - Non-root user for security

#### Web (Next.js)
- **Dockerfile**: `apps/web/Dockerfile`
- **Purpose**: Server-side rendered frontend
- **Features**:
  - Standalone output for production
  - Optimized static asset handling
  - Health check support

#### Worker
- **Dockerfile**: `apps/worker/Dockerfile`
- **Purpose**: Background job processing
- **Features**:
  - YouTube video synchronization
  - Scheduled tasks
  - Graceful shutdown handling

---

## Development Setup

### Starting Services

```bash
# Start all services
make start

# Start specific services
docker compose up -d postgres redis

# View logs
make logs
make logs-api  # Specific service logs
```

### Hot Reload

Development mode includes volume mounts for hot reload:

- `apps/api/src` → API source code
- `apps/web/src` → Frontend source code
- `apps/worker/src` → Worker source code

Changes to source files will automatically reload the services.

### Accessing Containers

```bash
# Open shell in API container
make shell-api

# Open PostgreSQL shell
make db-shell

# Open any container shell
docker compose exec <service> sh
```

### Development Commands

```bash
make start          # Start all services
make stop           # Stop all services
make restart        # Restart all services
make restart-api    # Restart specific service
make logs           # View all logs
make logs-api       # View specific logs
make status         # Show service status
make build          # Build all images
make clean          # Remove all containers and volumes
```

---

## Production Deployment

### Initial Setup

1. **Create secrets directory**:
```bash
mkdir -p secrets
echo "your_db_user" > secrets/postgres_user.txt
echo "your_db_password" > secrets/postgres_password.txt
echo "your_jwt_secret" > secrets/jwt_secret.txt
echo "your_youtube_api_key" > secrets/youtube_api_key.txt
chmod 600 secrets/*.txt
```

2. **Configure environment**:
```bash
cp .env.production .env
# Edit .env with your production values
```

3. **Deploy**:
```bash
./scripts/deploy.sh production
# OR
make prod-deploy
```

### Zero-Downtime Deployment

The deployment script performs rolling updates:

1. Creates backup of current database
2. Builds new Docker images
3. Runs database migrations
4. Deploys services one at a time
5. Performs health checks
6. Rolls back on failure

### SSL/HTTPS Setup

1. **Initial certificate**:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com
```

2. **Update nginx.conf** with your domain

3. **Restart nginx**:
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### Production Commands

```bash
make prod-start     # Start production services
make prod-stop      # Stop production services
make prod-logs      # View production logs
make prod-deploy    # Full deployment
```

---

## Environment Configuration

### Environment Files

| File               | Purpose                          |
|--------------------|----------------------------------|
| `.env.development` | Local development settings       |
| `.env.staging`     | Staging environment settings     |
| `.env.production`  | Production environment settings  |
| `.env`             | Active environment (gitignored)  |

### Key Environment Variables

```bash
# Database
DATABASE_URL          # Full PostgreSQL connection string
POSTGRES_USER         # Database username
POSTGRES_PASSWORD     # Database password
POSTGRES_DB           # Database name

# Redis
REDIS_HOST            # Redis hostname
REDIS_PORT            # Redis port
REDIS_PASSWORD        # Redis password (production)

# API
API_PORT              # API server port
JWT_SECRET            # JWT signing secret
YOUTUBE_API_KEY       # YouTube Data API key

# Frontend
NEXT_PUBLIC_API_URL   # API URL for frontend

# Worker
WORKER_CONCURRENCY    # Number of concurrent jobs
MAX_YOUTUBE_CALLS_PER_MINUTE  # Rate limiting
```

---

## Database Management

### Migrations

```bash
# Run pending migrations
make db-migrate

# Create new migration
make db-migrate-dev

# Reset database (WARNING: destroys data)
make db-reset
```

### Seeding

```bash
# Seed with sample data
make db-seed
```

### Prisma Studio

```bash
# Open visual database browser
make db-studio
# Access at http://localhost:5555
```

### Backup & Restore

```bash
# Create backup
make backup

# Restore from backup
make restore BACKUP=./backups/db_hbcu_band_hub_20240101_120000.sql.gz
```

---

## Networking

### Development Network

```
hbcu-network (bridge)
├── postgres    (internal: 5432, external: 5432)
├── redis       (internal: 6379, external: 6379)
├── api         (internal: 3001, external: 3001)
├── web         (internal: 3000, external: 3000)
└── worker      (internal only)
```

### Production Networks

```
hbcu-internal (bridge, internal)
├── postgres    (5432)
├── redis       (6379)
├── api         (3001)
├── web         (3000)
└── worker

hbcu-external (bridge)
├── nginx       (80, 443)
└── certbot
```

### Port Mappings

| Service  | Development Port | Production Port |
|----------|------------------|-----------------|
| Web      | 3000             | 80, 443 (nginx) |
| API      | 3001             | via nginx       |
| Postgres | 5432             | internal only   |
| Redis    | 6379             | internal only   |

---

## Volumes

### Named Volumes

| Volume         | Purpose                    | Mount Point                    |
|----------------|----------------------------|--------------------------------|
| postgres_data  | Database files             | /var/lib/postgresql/data       |
| redis_data     | Redis persistence          | /data                          |
| api_uploads    | User-uploaded files        | /app/apps/api/uploads          |
| certbot_certs  | SSL certificates           | /etc/letsencrypt               |
| certbot_www    | ACME challenge directory   | /var/www/certbot               |

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect hbcu-band-hub_postgres_data

# Backup volume
docker run --rm -v hbcu-band-hub_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres_data.tar.gz /data

# Remove all volumes (WARNING)
make clean-volumes
```

---

## SSL/TLS Configuration

### Let's Encrypt Integration

1. **Request certificate**:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com --agree-tos --no-eff-email \
  -d yourdomain.com -d www.yourdomain.com
```

2. **Enable HTTPS in nginx.conf**:
   - Update server_name with your domain
   - Update certificate paths
   - Uncomment HTTPS redirect

3. **Automatic renewal**: The certbot container renews certificates automatically every 12 hours.

---

## Monitoring & Logging

### Health Checks

All services include health checks:

| Service  | Endpoint                        | Interval |
|----------|----------------------------------|----------|
| postgres | `pg_isready`                     | 10s      |
| redis    | `redis-cli ping`                 | 10s      |
| api      | `GET /api/health`                | 30s      |
| web      | `GET /`                          | 30s      |
| nginx    | `GET /`                          | 30s      |

### Logging

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api

# View logs with timestamps
docker compose logs -f -t api

# View last 100 lines
docker compose logs --tail=100 api
```

### Production Logging

Logs are configured with:
- JSON format for structured logging
- Log rotation (max 50MB, 5 files)
- Centralized via Docker logging driver

---

## Backup & Recovery

### Automated Backups

```bash
# Run backup script
./scripts/backup.sh

# Custom backup directory
./scripts/backup.sh /path/to/backups
```

### Backup Contents

- Database dump (gzip compressed)
- Uploads directory (tar.gz)
- Automatic cleanup (30 days retention)

### Recovery

```bash
# Restore database only
./scripts/restore.sh ./backups/db_hbcu_band_hub_20240101_120000.sql.gz

# Restore database and uploads
./scripts/restore.sh ./backups/db_20240101.sql.gz ./backups/uploads_20240101.tar.gz
```

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker compose logs <service>

# Check container status
docker compose ps

# Rebuild container
docker compose build --no-cache <service>
```

#### Database Connection Failed

```bash
# Check if PostgreSQL is healthy
docker compose exec postgres pg_isready

# Check connection from API
docker compose exec api nc -zv postgres 5432

# View PostgreSQL logs
docker compose logs postgres
```

#### Redis Connection Failed

```bash
# Check Redis health
docker compose exec redis redis-cli ping

# Check Redis logs
docker compose logs redis
```

#### Out of Memory

```bash
# Check resource usage
docker stats

# Adjust resource limits in docker-compose.prod.yml
```

#### Permission Denied

```bash
# Fix volume permissions
docker compose exec api chown -R 1001:1001 /app/apps/api/uploads
```

### Debug Mode

```bash
# Run container interactively
docker compose run --rm api sh

# Run with debug logging
DEBUG=* docker compose up api
```

---

## Security Considerations

### Best Practices Implemented

1. **Non-root users**: All application containers run as non-root users
2. **Multi-stage builds**: Production images don't include dev dependencies
3. **Secrets management**: Docker secrets for sensitive values
4. **Network isolation**: Internal network for database services
5. **Rate limiting**: Nginx rate limiting for API endpoints
6. **Health checks**: Automatic container restart on failure
7. **SSL/TLS**: HTTPS with Let's Encrypt certificates
8. **Security headers**: X-Frame-Options, X-Content-Type-Options, etc.

### Security Checklist

- [ ] Change default database passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable Redis password in production
- [ ] Configure proper CORS origins
- [ ] Keep Docker images updated
- [ ] Review and update dependencies regularly
- [ ] Enable firewall rules (only expose 80, 443)
- [ ] Set up monitoring and alerting
- [ ] Regular security audits

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Nginx Documentation](https://nginx.org/en/docs/)
