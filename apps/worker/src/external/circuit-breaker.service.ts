import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterPercent: number;
}

// Circuit breaker metrics
export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  openTime: number | null;
  halfOpenAttempts: number;
  failuresBeforeOpen: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastFailureTime: number | null;
  consecutiveFailures: number;
}

// Fallback options
export interface FallbackOptions<T> {
  cachedData?: T;
  partialResult?: T;
  defaultValue?: T;
}

// Job metadata for retry tracking
export interface RetryMetadata {
  attempt: number;
  maxAttempts: number;
  delays: number[];
  errors: string[];
  startTime: number;
  lastAttemptTime: number | null;
}

// Extended options for fire method
export interface FireOptions<T> {
  fallback?: FallbackOptions<T>;
  jobMetadata?: Record<string, unknown>;
  skipRetry?: boolean;
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // Retry configuration from environment
  private readonly retryConfig: RetryConfig;

  // Track metrics per circuit name
  private readonly metricsMap = new Map<string, CircuitBreakerMetrics>();

  // Track circuit states for half-open logic
  private readonly circuitStates = new Map<string, CircuitState>();

  // Cache for fallback data
  private readonly fallbackCache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // sensible defaults for YouTube external calls
  private readonly defaultOptions: CircuitBreaker.Options = {
    timeout: 10000, // 10s
    errorThresholdPercentage: 50,
    resetTimeout: 30000, // 30s
    rollingCountTimeout: 60000,
  } as CircuitBreaker.Options;

  constructor(private readonly configService: ConfigService) {
    // Load retry configuration from environment variables
    this.retryConfig = {
      maxAttempts: this.configService.get<number>('CIRCUIT_BREAKER_MAX_ATTEMPTS', 5),
      baseDelay: this.configService.get<number>('CIRCUIT_BREAKER_BASE_DELAY', 1000),
      maxDelay: this.configService.get<number>('CIRCUIT_BREAKER_MAX_DELAY', 30000),
      jitterPercent: this.configService.get<number>('CIRCUIT_BREAKER_JITTER_PERCENT', 25),
    };

    this.logger.log(`CircuitBreakerService initialized with config: ${JSON.stringify(this.retryConfig)}`);
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Formula: delay = baseDelay * (2 ^ attempt) with ±jitterPercent randomization
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);

    // Add jitter: randomize by ±jitterPercent to prevent thundering herd
    const jitterRange = cappedDelay * (this.retryConfig.jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange

    const finalDelay = Math.max(0, Math.round(cappedDelay + jitter));

    this.logger.debug(
      `Backoff calculation: attempt=${attempt}, exponential=${exponentialDelay}, capped=${cappedDelay}, jitter=${jitter.toFixed(0)}, final=${finalDelay}`,
    );

    return finalDelay;
  }

  /**
   * Initialize or get metrics for a circuit
   */
  private getOrCreateMetrics(name: string): CircuitBreakerMetrics {
    if (!this.metricsMap.has(name)) {
      this.metricsMap.set(name, {
        name,
        state: CircuitState.CLOSED,
        openTime: null,
        halfOpenAttempts: 0,
        failuresBeforeOpen: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastFailureTime: null,
        consecutiveFailures: 0,
      });
    }
    return this.metricsMap.get(name)!;
  }

  /**
   * Update metrics on success
   */
  private recordSuccess(name: string): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.consecutiveFailures = 0;

    // If we were in half-open state and succeeded, transition to closed
    if (metrics.state === CircuitState.HALF_OPEN) {
      this.logger.log(`Circuit ${name} recovered after successful test request`);
      metrics.state = CircuitState.CLOSED;
      metrics.openTime = null;
      metrics.halfOpenAttempts = 0;
      this.circuitStates.set(name, CircuitState.CLOSED);
    }
  }

  /**
   * Update metrics on failure
   */
  private recordFailure(name: string, error: Error): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.consecutiveFailures++;
    metrics.lastFailureTime = Date.now();

    // Track failures before circuit opens
    if (metrics.state === CircuitState.CLOSED) {
      metrics.failuresBeforeOpen++;
    }

    // If in half-open state and failed, go back to open
    if (metrics.state === CircuitState.HALF_OPEN) {
      metrics.halfOpenAttempts++;
      this.logger.warn(`Circuit ${name} test request failed, returning to open state`);
      metrics.state = CircuitState.OPEN;
      metrics.openTime = Date.now();
      this.circuitStates.set(name, CircuitState.OPEN);
    }
  }

  /**
   * Record circuit opening
   */
  private recordCircuitOpen(name: string): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.state = CircuitState.OPEN;
    metrics.openTime = Date.now();
    this.circuitStates.set(name, CircuitState.OPEN);
    this.logger.warn(`Circuit ${name} opened after ${metrics.failuresBeforeOpen} failures`);
  }

  /**
   * Attempt to enter half-open state for testing
   */
  private tryEnterHalfOpen(name: string): boolean {
    const metrics = this.getOrCreateMetrics(name);

    if (metrics.state !== CircuitState.OPEN) {
      return false;
    }

    // Check if enough time has passed since circuit opened
    const timeSinceOpen = Date.now() - (metrics.openTime || 0);
    if (timeSinceOpen < this.defaultOptions.resetTimeout!) {
      return false;
    }

    this.logger.log(`Circuit ${name} entering half-open state for test request`);
    metrics.state = CircuitState.HALF_OPEN;
    this.circuitStates.set(name, CircuitState.HALF_OPEN);
    return true;
  }

  /**
   * Get fallback value based on options
   */
  private getFallbackValue<T>(name: string, options?: FallbackOptions<T>): T | null {
    // Try cached data first
    if (options?.cachedData !== undefined) {
      this.logger.debug(`Using provided cached data for ${name}`);
      return options.cachedData;
    }

    // Check internal cache
    const cached = this.fallbackCache.get(name);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Using internal cached data for ${name}`);
      return cached.data as T;
    }

    // Try partial result
    if (options?.partialResult !== undefined) {
      this.logger.debug(`Using partial result for ${name}`);
      return options.partialResult;
    }

    // Try default value
    if (options?.defaultValue !== undefined) {
      this.logger.debug(`Using default value for ${name}`);
      return options.defaultValue;
    }

    return null;
  }

  /**
   * Cache successful result for future fallback
   */
  private cacheResult<T>(name: string, result: T): void {
    this.fallbackCache.set(name, {
      data: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Create retry metadata for tracking
   */
  createRetryMetadata(): RetryMetadata {
    return {
      attempt: 0,
      maxAttempts: this.retryConfig.maxAttempts,
      delays: [],
      errors: [],
      startTime: Date.now(),
      lastAttemptTime: null,
    };
  }

  /**
   * Fire a function through a circuit breaker with advanced retry logic
   */
  async fire<T>(
    action: () => Promise<T>,
    name = 'default',
    options?: FireOptions<T>,
  ): Promise<T> {
    const metrics = this.getOrCreateMetrics(name);
    const retryMetadata = this.createRetryMetadata();

    // Update job metadata if provided
    if (options?.jobMetadata) {
      options.jobMetadata.retryMetadata = retryMetadata;
    }

    // Check if circuit is open
    if (metrics.state === CircuitState.OPEN) {
      // Try to enter half-open state
      if (!this.tryEnterHalfOpen(name)) {
        this.logger.warn(`Circuit ${name} is open, attempting fallback`);
        const fallbackValue = this.getFallbackValue(name, options?.fallback);
        if (fallbackValue !== null) {
          return fallbackValue;
        }
        throw new Error('circuit_open');
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      retryMetadata.attempt = attempt + 1;
      retryMetadata.lastAttemptTime = Date.now();

      // Add delay for retries (not first attempt)
      if (attempt > 0) {
        const delay = this.calculateBackoffDelay(attempt);
        retryMetadata.delays.push(delay);
        this.logger.debug(`Retry attempt ${attempt + 1}/${this.retryConfig.maxAttempts} for ${name}, waiting ${delay}ms`);
        await this.sleep(delay);
      }

      // Skip retries if in half-open state (only one test request)
      if (metrics.state === CircuitState.HALF_OPEN && attempt > 0) {
        break;
      }

      const breaker = new CircuitBreaker(action, { ...this.defaultOptions });

      // Wire circuit state tracking
      breaker.on('open', () => this.recordCircuitOpen(name));
      breaker.on('halfOpen', () => {
        this.logger.log(`Opossum circuit ${name} half-open`);
      });
      breaker.on('close', () => {
        this.logger.log(`Opossum circuit ${name} closed`);
      });

      try {
        const result = await breaker.fire();
        this.recordSuccess(name);

        // Cache successful result for future fallback
        this.cacheResult(name, result);

        return result as T;
      } catch (error) {
        lastError = error as Error;
        retryMetadata.errors.push(lastError.message);
        this.recordFailure(name, lastError);

        this.logger.warn(
          `Attempt ${attempt + 1}/${this.retryConfig.maxAttempts} failed for ${name}: ${lastError.message}`,
        );

        // If circuit opened, try fallback
        if (lastError.message === 'circuit_open' || metrics.state === CircuitState.OPEN) {
          const fallbackValue = this.getFallbackValue(name, options?.fallback);
          if (fallbackValue !== null) {
            this.logger.log(`Circuit ${name} open, returning fallback value`);
            return fallbackValue;
          }
        }

        // Don't retry if explicitly requested
        if (options?.skipRetry) {
          break;
        }
      } finally {
        breaker.removeAllListeners();
      }
    }

    // All retries exhausted, try fallback one more time
    const fallbackValue = this.getFallbackValue(name, options?.fallback);
    if (fallbackValue !== null) {
      this.logger.log(`All retries exhausted for ${name}, returning fallback value`);
      return fallbackValue;
    }

    // Update job metadata with final state
    if (options?.jobMetadata) {
      options.jobMetadata.retryMetadata = retryMetadata;
    }

    throw lastError || new Error(`All ${this.retryConfig.maxAttempts} retry attempts exhausted for ${name}`);
  }

  /**
   * Get metrics for a specific circuit
   */
  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.metricsMap.get(name);
  }

  /**
   * Get metrics for all circuits
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.metricsMap.values());
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Reset metrics for a circuit (useful for testing)
   */
  resetMetrics(name: string): void {
    this.metricsMap.delete(name);
    this.circuitStates.delete(name);
    this.fallbackCache.delete(name);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metricsMap.clear();
    this.circuitStates.clear();
    this.fallbackCache.clear();
  }

  /**
   * Manually set cache for a circuit (useful for pre-warming)
   */
  setCache<T>(name: string, data: T): void {
    this.fallbackCache.set(name, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a circuit
   */
  clearCache(name: string): void {
    this.fallbackCache.delete(name);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onModuleDestroy() {
    // Log final metrics before shutdown
    const allMetrics = this.getAllMetrics();
    if (allMetrics.length > 0) {
      this.logger.log('CircuitBreakerService final metrics:');
      allMetrics.forEach((m) => {
        this.logger.log(
          `  ${m.name}: state=${m.state}, total=${m.totalRequests}, success=${m.successfulRequests}, failed=${m.failedRequests}`,
        );
      });
    }
    this.logger.log('CircuitBreakerService shutting down');
  }
}
