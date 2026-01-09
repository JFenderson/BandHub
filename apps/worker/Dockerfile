# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:20-alpine AS deps

# Install required packages for native dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY libs/shared/types/package.json ./libs/shared/types/

# Install dependencies
RUN npm ci --legacy-peer-deps

# ========================================
# Stage 2: Builder
# ========================================
FROM node:20-alpine AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source files
COPY . .

# Build shared types first
RUN cd libs/shared/types && npm run build

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build the worker application
RUN cd apps/worker && npm run build

# ========================================
# Stage 3: Production Runner
# ========================================
FROM node:20-alpine AS runner

# Install required packages for runtime
RUN apk add --no-cache openssl dumb-init

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 worker
RUN adduser --system --uid 1001 worker

# Set environment variables
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/libs/shared/types/dist ./libs/shared/types/dist
COPY --from=builder /app/libs/shared/types/package.json ./libs/shared/types/package.json

# Copy Prisma generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set correct ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Health check (using exit code since workers don't have HTTP endpoints)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -x node || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the worker
CMD ["node", "apps/worker/dist/apps/worker/src/main.js"]
