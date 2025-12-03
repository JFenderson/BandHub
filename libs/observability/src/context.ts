import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { NextFunction } from 'express';

export type RequestContext = {
  correlationId: string;
  userId?: string | null;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const getContext = () => storage.getStore();
export const getCorrelationId = () => storage.getStore()?.correlationId ?? 'unknown';

export const runWithContext = <T>(ctx: RequestContext, fn: () => T) =>
  storage.run(ctx, fn);

export const correlationIdMiddleware = (
  req: IncomingMessage & { headers: Record<string, string | string[]> },
  res: ServerResponse,
  next: NextFunction,
) => {
  const incoming = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(incoming) ? incoming[0] : incoming || randomUUID();
  res.setHeader('x-correlation-id', correlationId);

  runWithContext({ correlationId }, () => next());
};

export const attachUserContext = (userId?: string | null) => {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.userId = userId ?? undefined;
  }
};
