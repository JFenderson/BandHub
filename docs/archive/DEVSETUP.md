# HBCU Band Hub - Development Setup Guide

A comprehensive platform for showcasing and cataloging HBCU marching band performances from YouTube.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Daily Development](#daily-development)
- [Database Operations](#database-operations)
- [Common Issues & Solutions](#common-issues--solutions)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)

---

## Prerequisites

### Required Software
- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **PostgreSQL**: v16 or higher ([Download](https://www.postgresql.org/download/))
- **Docker Desktop**: Latest version ([Download](https://www.docker.com/products/docker-desktop/))
- **Git**: Latest version ([Download](https://git-scm.com/downloads))

### Optional (Recommended)
- **VS Code**: With Prisma extension
- **Postman** or **Insomnia**: For API testing

---

## Initial Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd BandHub
```

### 2. Install Dependencies
```bash
npm install
```

This installs dependencies for all apps in the monorepo (frontend, backend, shared libraries).

### 3. Set Up Environment Variables

Create a `.env` file in the **root directory**:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
```dotenv
# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/hbcu_band_hub?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# API Configuration
API_PORT="3001"
API_URL="http://localhost:3001"
PORT="3001"

# Frontend Configuration
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Environment
NODE_ENV="development"

# YouTube API
YOUTUBE_API_KEY="your_youtube_api_key_here"
YOUTUBE_QUOTA_LIMIT="10000"

# Worker Configuration
WORKER_CONCURRENCY="3"
MAX_YOUTUBE_CALLS_PER_MINUTE="60"

# Auth (generate with: openssl rand -hex 32)
JWT_SECRET="your_jwt_secret_here"
```

### 4. Start PostgreSQL

Make sure PostgreSQL is running:

**Windows (Services):**
1. Press `Win + R`, type `services.msc`
2. Find `postgresql-x64-XX` (where XX is your version)
3. Right-click → Start

**Or via command line:**
```bash
# Check if it's running
psql -U postgres -h localhost -c "SELECT version();"
```

### 5. Create the Database
```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE hbcu_band_hub;

# Exit
\q
```

### 6. Run Database Migrations
```bash
npx prisma migrate dev
```

This creates all tables (Band, Video, Category, AdminUser, AuditLog, SyncJob).

### 7. Start Redis with Docker
```bash
# Start Redis container
docker run -d --name redis -p 6379:6379 --restart unless-stopped redis:7-alpine

# Verify it's running
docker exec -it redis redis-cli ping
# Should return: PONG
```

### 8. (Optional) Seed the Database
```bash
npm run seed
```

This populates the database with 35+ HBCU bands and 100+ videos.

---

## Daily Development

### Start All Services

**Terminal 1 - Backend API:**
```bash
npm run dev:api
```
Runs on: `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev:web
```
Runs on: `http://localhost:3000`

**Terminal 3 - Worker (Background Jobs):**
```bash
npm run dev:worker
```

### Check Service Health

**PostgreSQL:**
```bash
psql -U postgres -h localhost -d hbcu_band_hub
```

**Redis:**
```bash
docker exec -it redis redis-cli ping
```

**API:**
```bash
curl http://localhost:3001/health
```

---

## Database Operations

### View Database in Prisma Studio
```bash
npx prisma studio
```

Opens a web UI at `http://localhost:5555` to browse/edit data.

### Create a New Migration
```bash
npx prisma migrate dev --name describe_your_changes
```

### Reset Database (⚠️ Deletes all data)
```bash
npx prisma migrate reset
```

### Generate Prisma Client (after schema changes)
```bash
npx prisma generate
```

### Run Seeds Again
```bash
npm run seed
```

---

## Common Issues & Solutions

### Issue 1: "Authentication failed against database"

**Symptom:**
```
Error: P1000: Authentication failed against database server at `localhost`
```

**Solution:**

1. **Check your DATABASE_URL format:**
```dotenv
   # Correct format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/hbcu_band_hub?schema=public"
```

2. **Reset PostgreSQL password:**

   a. Find `pg_hba.conf` (usually in `C:\Program Files\PostgreSQL\18\data\`)
   
   b. Edit as Administrator, change:
```
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
```
   To:
```
   host    all             all             127.0.0.1/32            trust
   host    all             all             ::1/128                 trust
```
   
   c. Restart PostgreSQL service (via Services or command line)
   
   d. Connect and reset password:
```bash
   psql -U postgres -h localhost
   ALTER USER postgres WITH PASSWORD 'newpassword';
   \q
```
   
   e. Revert `pg_hba.conf` back to `scram-sha-256`
   
   f. Restart PostgreSQL again
   
   g. Update `.env` with new password

---

### Issue 2: "Database does not exist"

**Symptom:**
```
Error: P1003 The introspected database does not exist
```

**Solution:**
```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE hbcu_band_hub;
\q

# Run migrations
npx prisma migrate dev
```

---

### Issue 3: "Redis connection refused"

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

**Option A: Start Docker Redis (Recommended)**
```bash
# Check if container exists but is stopped
docker ps -a

# If it exists, start it
docker start redis

# If it doesn't exist, create it
docker run -d --name redis -p 6379:6379 --restart unless-stopped redis:7-alpine

# Verify
docker exec -it redis redis-cli ping
```

**Option B: Check if something else is using port 6379**
```bash
# Find what's using the port
netstat -ano | grep 6379

# If Docker container conflicts, remove old one
docker rm -f redis

# Create fresh container
docker run -d --name redis -p 6379:6379 --restart unless-stopped redis:7-alpine
```

**Option C: Docker Desktop not running**
1. Start Docker Desktop
2. Wait for it to fully initialize (whale icon steady)
3. Run the docker commands above

---

### Issue 4: "Conflicting environment variables"

**Symptom:**
```
There is a conflict between env vars in apps\api\.env and .env
```

**Solution:**

1. **Delete** `apps/api/.env` (we only need root `.env`)
```bash
   rm apps/api/.env
```

2. **Ensure all variables are in root `.env`**

3. **Regenerate Prisma Client:**
```bash
   npx prisma generate
```

---

### Issue 5: Docker Desktop won't start/quit

**Symptom:**
- Docker Desktop frozen
- Can't start/stop containers
- "pipe/dockerDesktopLinuxEngine" errors

**Solution:**

**Option A: Force quit via Task Manager**
1. Press `Ctrl + Shift + Esc`
2. Find all Docker processes
3. End Task for each
4. Restart Docker Desktop

**Option B: Restart Windows**
- Fastest way to clean up stuck Docker processes

**Option C: Use WSL Redis instead**
```bash
# Install Ubuntu WSL
wsl --install -d Ubuntu

# Inside Ubuntu:
sudo apt update
sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping

# Make it auto-start
echo "sudo service redis-server start" >> ~/.bashrc
```

---

### Issue 6: "Port already in use"

**Symptom:**
```
Error: Port 3001 is already in use
```

**Solution:**

**Find and kill the process:**
```bash
# Windows (PowerShell as Admin)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force

# Or find the process ID
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Or use a different port:**
Update `.env`:
```dotenv
API_PORT="3002"
PORT="3002"
```

---

### Issue 7: TypeScript compilation errors in monorepo

**Symptom:**
- Module not found errors
- Build failures
- Import path issues

**Solution:**

1. **Clean and rebuild:**
```bash
   # Clean all build outputs
   npm run clean

   # Reinstall dependencies
   rm -rf node_modules
   npm install

   # Rebuild
   npm run build
```

2. **Generate Prisma Client:**
```bash
   npx prisma generate
```

3. **Check workspace structure:**
   - Ensure `package.json` has correct workspace paths
   - Verify `tsconfig.json` paths are correct

---

## Project Structure
```
BandHub/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── prisma/       # Database schema & migrations
│   │   ├── src/
│   │   │   ├── bands/
│   │   │   ├── videos/
│   │   │   ├── categories/
│   │   │   ├── admin/
│   │   │   └── worker/
│   │   └── package.json
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App Router pages
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── worker/           # BullMQ background jobs
├── packages/
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utilities
├── .env                  # Environment variables (root)
├── package.json          # Root package.json
├── turbo.json            # Turborepo configuration
└── README.md             # This file
```

---

## Available Scripts

### Root Level
```bash
# Install all dependencies
npm install

# Development
npm run dev              # Start all apps in dev mode
npm run dev:api          # Start backend only
npm run dev:web          # Start frontend only
npm run dev:worker       # Start worker only

# Building
npm run build            # Build all apps
npm run build:api        # Build backend only
npm run build:web        # Build frontend only

# Database
npm run seed             # Seed database with sample data
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create/run migrations
npx prisma generate      # Generate Prisma Client

# Linting & Formatting
npm run lint             # Lint all packages
npm run format           # Format code with Prettier

# Testing
npm run test             # Run all tests
npm run test:api         # Test backend only
```

### API-Specific (in `apps/api/`)
```bash
npm run start            # Start in production mode
npm run start:dev        # Start in watch mode
npm run start:debug      # Start with debugger
```

---

## Quick Reference

### Services & Ports

| Service       | Port | URL                          |
|---------------|------|------------------------------|
| Frontend      | 3000 | http://localhost:3000        |
| Backend API   | 3001 | http://localhost:3001        |
| PostgreSQL    | 5432 | localhost:5432               |
| Redis         | 6379 | localhost:6379               |
| Prisma Studio | 5555 | http://localhost:5555        |

### Key Files

| File                          | Purpose                           |
|-------------------------------|-----------------------------------|
| `.env`                        | Environment variables (root)      |
| `apps/api/prisma/schema.prisma` | Database schema                 |
| `turbo.json`                  | Turborepo build configuration     |
| `package.json` (root)         | Workspace & script definitions    |

### Useful Commands
```bash
# Check if services are running
docker ps                                    # Check Docker containers
psql -U postgres -h localhost -l            # List databases
redis-cli -h localhost ping                 # Test Redis (if installed locally)
docker exec -it redis redis-cli ping        # Test Redis (in Docker)

# View logs
docker logs redis                           # Redis logs
npm run dev:api                             # API logs (live)

# Database quick access
npx prisma studio                           # GUI
psql -U postgres -h localhost -d hbcu_band_hub  # CLI
```

---

## Getting Help

### Internal Resources
- Check `apps/api/src/` for backend code
- Check `apps/web/app/` for frontend pages
- Check `apps/api/prisma/schema.prisma` for data models

### External Resources
- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [BullMQ Docs](https://docs.bullmq.io/)

---

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] Docker Desktop is running
- [ ] PostgreSQL service is running
- [ ] Redis container is running (`docker ps`)
- [ ] `.env` file exists in root with correct values
- [ ] Database exists (`psql -U postgres -l`)
- [ ] Prisma Client is generated (`npx prisma generate`)
- [ ] Dependencies are installed (`npm install`)
- [ ] No port conflicts (3000, 3001, 5432, 6379)

---

## Notes

- **Always use root `.env`**: Never create `apps/api/.env` (causes conflicts)
- **Redis via Docker**: More reliable than WSL on Windows
- **Monorepo commands**: Use `-w` flag to target specific workspace: `npm run dev -w api`
- **PostgreSQL version**: Currently using version 18
- **Node version**: Tested with Node 18+

---

**Last Updated:** November 2024