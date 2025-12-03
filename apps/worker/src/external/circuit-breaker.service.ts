import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // sensible defaults for YouTube external calls
  private readonly defaultOptions: CircuitBreaker.Options = {
    timeout: 10000, // 10s
    errorThresholdPercentage: 50,
    resetTimeout: 30000, // 30s
    rollingCountTimeout: 60000,
  } as CircuitBreaker.Options;

  // Fire a function through a temporary circuit breaker.
  // We create per-call breakers to keep this simple and avoid global state.
  async fire<T>(action: () => Promise<T>, name = 'default'): Promise<T> {
    const breaker = new CircuitBreaker(action, { ...this.defaultOptions });

    // Provide a clear fallback that rejects so callers can handle it explicitly
    breaker.fallback(() => {
      // fallback should reject to preserve upstream retry/backoff semantics
      throw new Error('circuit_open');
    });

    // Wire simple logging for observability
    breaker.on('open', () => this.logger.warn(`circuit ${name} opened`));
    breaker.on('halfOpen', () => this.logger.log(`circuit ${name} half-open`));
    breaker.on('close', () => this.logger.log(`circuit ${name} closed`));

    try {
      const result = await breaker.fire();
      return result as T;
    } finally {
      // clean up listeners to avoid leaks
      breaker.removeAllListeners();
    }
  }

  onModuleDestroy() {
    // Nothing to teardown for per-call breakers; if we switch to pooled breakers,
    // implement shutdown logic here.
    this.logger.log('CircuitBreakerService shutting down');
  }
}
