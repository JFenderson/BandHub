import { trace } from '@opentelemetry/api';

export const TraceMethod = (name?: string): MethodDecorator =>
  function (_target, propertyKey, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const tracer = trace.getTracer('bandhub');
      const span = tracer.startSpan(name || String(propertyKey));
      try {
        const result = await original.apply(this, args);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    };
  };
