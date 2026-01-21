import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  SetMetadata,
  ExecutionContext,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Reflector } from '@nestjs/core';

/**
 * Metadata key for the UseReadReplica decorator
 */
export const USE_READ_REPLICA_KEY = 'useReadReplica';

/**
 * Decorator to mark controller methods that should use the read replica
 * Use this on GET endpoints that only read data
 *
 * @example
 * ```typescript
 * @Get()
 * @UseReadReplica()
 * findAll() {
 *   return this.service.findAll();
 * }
 * ```
 */
export const UseReadReplica = () => SetMetadata(USE_READ_REPLICA_KEY, true);

/**
 * Configuration for the read replica connection
 */
interface ReadReplicaConfig {
  /** Maximum number of connections in the replica pool (default: 10) */
  connectionLimit: number;
  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout: number;
  /** Interval for health checks in milliseconds (default: 30000) */
  healthCheckInterval: number;
  /** Maximum retry attempts before falling back to primary (default: 3) */
  maxRetries: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay: number;
}

const DEFAULT_REPLICA_CONFIG: ReadReplicaConfig = {
  connectionLimit: parseInt(process.env.REPLICA_POOL_SIZE || '10', 10),
  connectTimeout: parseInt(process.env.REPLICA_CONNECT_TIMEOUT || '10000', 10),
  healthCheckInterval: parseInt(process.env.REPLICA_HEALTH_CHECK_INTERVAL || '30000', 10),
  maxRetries: parseInt(process.env.REPLICA_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.REPLICA_RETRY_DELAY || '1000', 10),
};

/**
 * Query types that are safe to route to read replicas
 */
const READ_OPERATIONS = ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy'];

/**
 * Query types that must go to the primary database
 */
const WRITE_OPERATIONS = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
];

/**
 * Health status of the read replica
 */
interface ReplicaHealth {
  healthy: boolean;
  latency: number;
  lastCheck: Date;
  consecutiveFailures: number;
  message?: string;
}

/**
 * ReadReplicaService extends PrismaClient to provide automatic read/write splitting.
 *
 * Features:
 * - Automatic routing of read queries to replica
 * - Fallback to primary database if replica is unavailable
 * - Health checks for replica connection
 * - Connection pooling for replica
 * - Metrics and logging
 *
 * Usage:
 * - Inject this service instead of PrismaService for read-heavy operations
 * - Use the @UseReadReplica() decorator on controller methods
 * - Call readReplica.band.findMany() for explicit replica reads
 */
@Injectable()
export class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadReplicaService.name);
  private readonly config: ReadReplicaConfig;
  private replicaClient: PrismaClient | null = null;
  private primaryClient: PrismaClient;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private connectionStartTime: Date | null = null;
  private replicaHealth: ReplicaHealth = {
    healthy: false,
    latency: 0,
    lastCheck: new Date(),
    consecutiveFailures: 0,
  };

  constructor() {
    this.config = { ...DEFAULT_REPLICA_CONFIG };

    // Initialize primary client
    this.primaryClient = new PrismaClient({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
      datasources: {
        db: {
          url: this.buildConnectionUrl(process.env.DATABASE_URL || ''),
        },
      },
    });

    // Initialize replica client if replica URL is configured
    const replicaUrl = process.env.DATABASE_REPLICA_URL;
    if (replicaUrl) {
      this.replicaClient = new PrismaClient({
        log: [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
        datasources: {
          db: {
            url: this.buildConnectionUrl(replicaUrl),
          },
        },
      });
      this.logger.log('Read replica configured');
    } else {
      this.logger.warn('No DATABASE_REPLICA_URL configured, all queries will use primary database');
    }

    this.setupEventHandlers();
  }

  /**
   * Builds the connection URL with pool parameters
   */
  private buildConnectionUrl(baseUrl: string): string {
    if (!baseUrl) return baseUrl;

    try {
      const url = new URL(baseUrl);

      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', String(this.config.connectionLimit));
      }
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', String(Math.floor(this.config.connectTimeout / 1000)));
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', String(Math.floor(this.config.connectTimeout / 1000)));
      }

      return url.toString();
    } catch {
      return baseUrl;
    }
  }

  /**
   * Setup event handlers for logging
   */
  private setupEventHandlers(): void {
    this.primaryClient.$on('warn' as never, (e: any) => {
      this.logger.warn(`[Primary] ${e.message}`);
    });

    this.primaryClient.$on('error' as never, (e: any) => {
      this.logger.error(`[Primary] ${e.message}`);
    });

    if (this.replicaClient) {
      this.replicaClient.$on('warn' as never, (e: any) => {
        this.logger.warn(`[Replica] ${e.message}`);
      });

      this.replicaClient.$on('error' as never, (e: any) => {
        this.logger.error(`[Replica] ${e.message}`);
      });
    }
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing read replica service...');

      // Connect to primary
      await this.connectWithTimeout(this.primaryClient, 'primary');
      this.logger.log('Connected to primary database');

      // Connect to replica if configured
      if (this.replicaClient) {
        try {
          await this.connectWithTimeout(this.replicaClient, 'replica');
          this.replicaHealth.healthy = true;
          this.replicaHealth.consecutiveFailures = 0;
          this.logger.log('Connected to read replica');
        } catch (error) {
          this.logger.warn('Failed to connect to read replica, using primary for all queries', error);
          this.replicaHealth.healthy = false;
          this.replicaHealth.message = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      this.connectionStartTime = new Date();

      // Start health checks
      this.startHealthChecks();

    } catch (error) {
      this.logger.error('Failed to initialize read replica service:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Shutting down read replica service...');

    this.stopHealthChecks();

    try {
      await this.primaryClient.$disconnect();
      this.logger.log('Primary database disconnected');

      if (this.replicaClient) {
        await this.replicaClient.$disconnect();
        this.logger.log('Replica database disconnected');
      }
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Connect with timeout
   */
  private async connectWithTimeout(client: PrismaClient, name: string): Promise<void> {
    const connectPromise = client.$connect();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout for ${name}`)), this.config.connectTimeout);
    });

    await Promise.race([connectPromise, timeoutPromise]);
  }

  /**
   * Start periodic health checks for the replica
   */
  private startHealthChecks(): void {
    if (!this.replicaClient || this.config.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckIntervalId = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.checkReplicaHealth();
    }, this.config.healthCheckInterval);

    this.logger.debug(`Replica health checks started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
      this.logger.debug('Replica health checks stopped');
    }
  }

  /**
   * Check the health of the read replica
   */
  async checkReplicaHealth(): Promise<ReplicaHealth> {
    if (!this.replicaClient) {
      return {
        healthy: false,
        latency: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        message: 'No replica configured',
      };
    }

    const startTime = Date.now();

    try {
      await this.replicaClient.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      this.replicaHealth = {
        healthy: true,
        latency,
        lastCheck: new Date(),
        consecutiveFailures: 0,
      };

      if (latency > 1000) {
        this.logger.warn(`Replica health check slow: ${latency}ms`);
      }

      return this.replicaHealth;
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.replicaHealth = {
        healthy: false,
        latency,
        lastCheck: new Date(),
        consecutiveFailures: this.replicaHealth.consecutiveFailures + 1,
        message,
      };

      this.logger.error(`Replica health check failed: ${message}`);

      // Try to reconnect if too many consecutive failures
      if (this.replicaHealth.consecutiveFailures >= this.config.maxRetries) {
        this.logger.warn('Attempting to reconnect to replica...');
        try {
          await this.replicaClient.$disconnect();
          await this.connectWithTimeout(this.replicaClient, 'replica');
          this.replicaHealth.healthy = true;
          this.replicaHealth.consecutiveFailures = 0;
          this.logger.log('Reconnected to read replica');
        } catch (reconnectError) {
          this.logger.error('Failed to reconnect to replica:', reconnectError);
        }
      }

      return this.replicaHealth;
    }
  }

  /**
   * Check health of both primary and replica
   */
  async checkHealth(): Promise<{
    primary: { healthy: boolean; latency: number };
    replica: ReplicaHealth;
  }> {
    const primaryStart = Date.now();
    let primaryHealthy = true;
    let primaryLatency = 0;

    try {
      await this.primaryClient.$queryRaw`SELECT 1`;
      primaryLatency = Date.now() - primaryStart;
    } catch {
      primaryHealthy = false;
      primaryLatency = Date.now() - primaryStart;
    }

    const replicaHealth = await this.checkReplicaHealth();

    return {
      primary: { healthy: primaryHealthy, latency: primaryLatency },
      replica: replicaHealth,
    };
  }

  /**
   * Get the appropriate client for a query
   * Read operations go to replica if healthy, otherwise primary
   * Write operations always go to primary
   */
  private getClientForOperation(operation: string): PrismaClient {
    const isReadOperation = READ_OPERATIONS.includes(operation);

    if (isReadOperation && this.replicaClient && this.replicaHealth.healthy) {
      return this.replicaClient;
    }

    return this.primaryClient;
  }

  /**
   * Execute a read query with automatic fallback to primary
   */
  async executeRead<T>(
    queryFn: (client: PrismaClient) => Promise<T>,
    retryCount = 0,
  ): Promise<T> {
    const useReplica = this.replicaClient && this.replicaHealth.healthy;
    const client = useReplica ? this.replicaClient! : this.primaryClient;

    try {
      return await queryFn(client);
    } catch (error) {
      if (useReplica && retryCount < this.config.maxRetries) {
        this.logger.warn(`Read query failed on replica, retrying (${retryCount + 1}/${this.config.maxRetries})...`);

        // Mark replica as unhealthy temporarily
        this.replicaHealth.consecutiveFailures++;

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

        // Retry with primary
        return this.executeRead(queryFn, retryCount + 1);
      }

      // If replica is unavailable or max retries reached, try primary
      if (useReplica) {
        this.logger.warn('Falling back to primary database');
        this.replicaHealth.healthy = false;

        try {
          return await queryFn(this.primaryClient);
        } catch (primaryError) {
          this.logger.error('Query failed on both replica and primary:', primaryError);
          throw primaryError;
        }
      }

      throw error;
    }
  }

  /**
   * Execute a write query (always uses primary)
   */
  async executeWrite<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return queryFn(this.primaryClient);
  }

  /**
   * Get the primary Prisma client (for write operations)
   */
  get primary(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Get the replica Prisma client (for explicit read operations)
   * Falls back to primary if replica is unavailable
   */
  get replica(): PrismaClient {
    if (this.replicaClient && this.replicaHealth.healthy) {
      return this.replicaClient;
    }
    return this.primaryClient;
  }

  /**
   * Check if the read replica is currently available
   */
  isReplicaAvailable(): boolean {
    return this.replicaClient !== null && this.replicaHealth.healthy;
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): {
    replicaConfigured: boolean;
    replicaHealthy: boolean;
    replicaLatency: number;
    consecutiveFailures: number;
    lastHealthCheck: Date;
    uptimeSeconds: number;
  } {
    const uptime = this.connectionStartTime
      ? Math.floor((Date.now() - this.connectionStartTime.getTime()) / 1000)
      : 0;

    return {
      replicaConfigured: this.replicaClient !== null,
      replicaHealthy: this.replicaHealth.healthy,
      replicaLatency: this.replicaHealth.latency,
      consecutiveFailures: this.replicaHealth.consecutiveFailures,
      lastHealthCheck: this.replicaHealth.lastCheck,
      uptimeSeconds: uptime,
    };
  }
}

/**
 * Helper to check if a method should use read replica
 */
export function shouldUseReadReplica(reflector: Reflector, context: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(USE_READ_REPLICA_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) ?? false;
}
