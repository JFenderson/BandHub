import * as Sentry from '@sentry/node';
import { getCorrelationId } from './context';

export const initSentry = (serviceName: string) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE,
    integrations: [Sentry.httpIntegration(), Sentry.prismaIntegration?.()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.5),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0),
    beforeSend(event) {
      const correlationId = getCorrelationId();
      if (correlationId) {
        event.tags = { ...event.tags, correlationId };
      }
      return event;
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
