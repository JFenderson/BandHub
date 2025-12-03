import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breaker: CircuitBreaker;

  constructor() {
    const options = {
      timeout: 5000, // If function takes longer, it fails
      errorThresholdPercentage: 50, // % of failures to open circuit
      resetTimeout: 30_000, // ms to wait before trying again
      rollingCountTimeout: 10_000,
    };

    // Create a noop breaker that can wrap any promise-returning function via `fire`
    this.breaker = new CircuitBreaker((...args: any[]) => Promise.resolve(args), options);
    this.breaker.fallback((...args: any[]) => {
      this.logger.warn('Circuit fallback invoked');
      return { error: 'circuit_open' };
    });
  }

  async fire<T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> {
    // Use the breaker to execute provided function
    try {
      // opossum uses function provided on creation; use execute pattern via promise
      // We'll create a wrapped function each call
      const proxy = new CircuitBreaker(() => fn(...args), this.breaker.options);
      proxy.fallback(() => ({ error: 'circuit_open' } as any));
      return await proxy.fire();
    } catch (err) {
      this.logger.error('Circuit breaker execution failed', err as any);
      throw err;
    }
  }
}
