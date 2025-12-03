import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { context, trace } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

export const startTracing = (serviceName: string) => {
  if (sdk) return sdk;

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? Object.fromEntries(
          process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map((kv) => kv.split('=')),
        )
      : {},
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'bandhub',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.RELEASE || 'local',
    }),
    traceExporter: exporter,
    textMapPropagator: new B3Propagator(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  return sdk;
};

export const shutdownTracing = async () => {
  if (!sdk) return;
  await sdk.shutdown();
};

export const startSpan = (name: string, fn: () => Promise<unknown> | unknown) => {
  const tracer = trace.getTracer('bandhub');
  const span = tracer.startSpan(name);
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      return await fn();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2 });
      throw error;
    } finally {
      span.end();
    }
  });
};
