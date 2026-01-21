import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Connection pool configuration options.
 * These can be overridden via environment variables or DATABASE_URL parameters.
 */
interface ConnectionPoolConfig {
  /** Maximum number of connections in the pool (default: 20) */
  connectionLimit: number;
  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout: number;
  /** Interval for health checks in milliseconds (default: 30000) */
  healthCheckInterval: number;
  /** Interval for logging pool metrics in milliseconds (default: 60000) */
  metricsLogInterval: number;
}

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  connectionLimit: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
  connectTimeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10000', 10),
  healthCheckInterval: parseInt(process.env.DATABASE_HEALTH_CHECK_INTERVAL || '30000', 10),
  metricsLogInterval: parseInt(process.env.DATABASE_METRICS_LOG_INTERVAL || '60000', 10),
};

/**
 * PrismaService wraps the Prisma Client and handles connection lifecycle.
 * This service is used across all applications (API, Worker) for database access.
 *
 * Features:
 * - Connection pooling with configurable limits
 * - Connection timeout handling
 * - Periodic health checks
 * - Graceful shutdown
 * - Connection pool metrics logging
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolConfig: ConnectionPoolConfig;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private metricsIntervalId: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private connectionStartTime: Date | null = null;

  constructor() {
    const poolConfig = { ...DEFAULT_POOL_CONFIG };

    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
      datasources: {
        db: {
          url: PrismaService.buildConnectionUrl(),
        },
      },
    });

    this.poolConfig = poolConfig;

    // Log warnings and errors
    this.$on('warn' as never, (e: any) => {
      this.logger.warn(e.message);
    });

    this.$on('error' as never, (e: any) => {
      this.logger.error(e.message);
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: any) => {
        if (e.duration > 1000) {
          this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  /**
   * Builds the connection URL with pool parameters appended
   */
  private static buildConnectionUrl(): string {
    const baseUrl = process.env.DATABASE_URL || '';
    if (!baseUrl) {
      return baseUrl;
    }

    const poolSize = process.env.DATABASE_POOL_SIZE || '20';
    const connectTimeout = process.env.DATABASE_CONNECT_TIMEOUT || '10';

    const url = new URL(baseUrl);

    // Add connection pool parameters if not already present
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', poolSize);
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', connectTimeout);
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', connectTimeout);
    }

    return url.toString();
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing database connection pool...');
      this.logger.log(`Pool configuration: max=${this.poolConfig.connectionLimit}, timeout=${this.poolConfig.connectTimeout}ms`);

      const connectPromise = this.$connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.poolConfig.connectTimeout);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      this.connectionStartTime = new Date();
      this.logger.log('Connected to PostgreSQL database');

      // Start health checks
      this.startHealthChecks();

      // Start metrics logging
      this.startMetricsLogging();

    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Initiating graceful database shutdown...');

    // Stop health checks and metrics logging
    this.stopHealthChecks();
    this.stopMetricsLogging();

    try {
      // Allow pending queries to complete (max 5 seconds)
      await this.waitForPendingQueries(5000);

      await this.$disconnect();
      this.logger.log('Database connection pool closed gracefully');
    } catch (error) {
      this.logger.error('Error during database shutdown:', error);
      // Force disconnect
      await this.$disconnect();
    }
  }

  /**
   * Wait for pending queries to complete before shutdown
   */
  private async waitForPendingQueries(timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Execute a quick query to check if connection is idle
        await this.$queryRaw`SELECT 1`;
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.warn('Timeout waiting for pending queries, forcing disconnect');
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.poolConfig.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckIntervalId = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.checkHealth();
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, this.poolConfig.healthCheckInterval);

    this.logger.debug(`Health checks started (interval: ${this.poolConfig.healthCheckInterval}ms)`);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
      this.logger.debug('Health checks stopped');
    }
  }

  /**
   * Perform a health check on the database connection
   */
  async checkHealth(): Promise<{ healthy: boolean; latency: number; message?: string }> {
    const startTime = Date.now();

    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      if (latency > 1000) {
        this.logger.warn(`Database health check slow: ${latency}ms`);
      }

      return { healthy: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Database health check failed: ${message}`);
      return { healthy: false, latency, message };
    }
  }

  /**
   * Start periodic metrics logging
   */
  private startMetricsLogging(): void {
    if (this.poolConfig.metricsLogInterval <= 0 || process.env.NODE_ENV === 'test') {
      return;
    }

    this.metricsIntervalId = setInterval(() => {
      if (this.isShuttingDown) return;
      this.logPoolMetrics();
    }, this.poolConfig.metricsLogInterval);

    this.logger.debug(`Metrics logging started (interval: ${this.poolConfig.metricsLogInterval}ms)`);
  }

  /**
   * Stop metrics logging
   */
  private stopMetricsLogging(): void {
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
      this.logger.debug('Metrics logging stopped');
    }
  }

  /**
   * Log connection pool metrics
   */
  private logPoolMetrics(): void {
    const uptime = this.connectionStartTime
      ? Math.floor((Date.now() - this.connectionStartTime.getTime()) / 1000)
      : 0;

    this.logger.log({
      message: 'Connection pool metrics',
      poolSize: this.poolConfig.connectionLimit,
      connectTimeout: this.poolConfig.connectTimeout,
      uptimeSeconds: uptime,
    });
  }

  /**
   * Get current pool metrics for external monitoring
   */
  getPoolMetrics(): {
    poolSize: number;
    connectTimeout: number;
    healthCheckInterval: number;
    uptimeSeconds: number;
    isHealthy: boolean;
  } {
    const uptime = this.connectionStartTime
      ? Math.floor((Date.now() - this.connectionStartTime.getTime()) / 1000)
      : 0;

    return {
      poolSize: this.poolConfig.connectionLimit,
      connectTimeout: this.poolConfig.connectTimeout,
      healthCheckInterval: this.poolConfig.healthCheckInterval,
      uptimeSeconds: uptime,
      isHealthy: !this.isShuttingDown && this.connectionStartTime !== null,
    };
  }

  /**
   * Clean all tables (use in tests only)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this] as any;
        if (model?.deleteMany) {
          return model.deleteMany();
        }
      }),
    );
  }
}