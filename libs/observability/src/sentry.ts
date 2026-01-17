import * as Sentry from '@sentry/node';
import { getCorrelationId } from './context';

export const initSentry = (serviceName: string) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE || process.env.npm_package_version,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.prismaIntegration?.(),
      Sentry.redisIntegration?.(),
    ],
    // Performance monitoring - capture 100% of transactions in production
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 1.0),
    // Profiling - capture 100% of profiles for performance analysis
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 1.0),
    
    // Custom error grouping and enrichment
    beforeSend(event, _hint) {
      const correlationId = getCorrelationId();
      if (correlationId) {
        event.tags = { ...event.tags, correlationId };
      }
      
      // Add service name tag
      event.tags = { ...event.tags, service: serviceName };
      
      // Custom error grouping rules
      if (event.exception?.values?.[0]) {
        const exception = event.exception.values[0];
        
        // Group database errors by query type, not specific values
        if (exception.type?.includes('Prisma') || exception.value?.includes('prisma')) {
          event.fingerprint = ['{{ default }}', 'database-error', exception.type || 'unknown'];
        }
        
        // Group rate limit errors together
        if (exception.value?.includes('rate limit') || exception.value?.includes('too many requests')) {
          event.fingerprint = ['rate-limit-exceeded'];
        }
        
        // Group validation errors by field name
        if (exception.type?.includes('Validation') || exception.value?.includes('validation')) {
          event.fingerprint = ['{{ default }}', 'validation-error'];
        }
        
        // Group external API errors by service
        if (exception.value?.includes('YouTube') || exception.value?.includes('googleapis')) {
          event.fingerprint = ['external-api-error', 'youtube'];
        }
      }
      
      return event;
    },
    
    // Add additional context for errors
    beforeBreadcrumb(breadcrumb) {
      // Add correlation ID to breadcrumbs
      const correlationId = getCorrelationId();
      if (correlationId) {
        breadcrumb.data = { ...breadcrumb.data, correlationId };
      }
      return breadcrumb;
    },
  });
};

export const setUserContext = (user: { id: string; email?: string } | null) => {
  if (!process.env.SENTRY_DSN) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
};

export const captureBreadcrumb = (message: string, data?: Record<string, unknown>) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.addBreadcrumb({ message, data });
};

export const captureError = (error: unknown) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error);
};
