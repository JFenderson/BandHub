# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:20-alpine AS deps

# Install required packages for native dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
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
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source files
COPY . .

# Build shared types first
RUN cd libs/shared/types && npm run build

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build the NestJS application
RUN cd apps/api && npm run build

# ========================================
# Stage 3: Production Runner
# ========================================
FROM node:20-alpine AS runner

# Install required packages for runtime
RUN apk add --no-cache openssl dumb-init

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/libs/shared/types/dist ./libs/shared/types/dist
COPY --from=builder /app/libs/shared/types/package.json ./libs/shared/types/package.json

# Copy Prisma generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create uploads directory
RUN mkdir -p /app/apps/api/uploads && chown -R nestjs:nestjs /app/apps/api/uploads

# Set correct ownership
RUN chown -R nestjs:nestjs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health/ready || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
