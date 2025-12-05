import pino, { Logger, LoggerOptions } from 'pino';
import pinoHttp from 'pino-http';
import { getContext } from './context';

const defaultOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  mixin() {
    const context = getContext();
    return context ?  { correlationId: context.correlationId, userId: context.userId } : {};
  },
};

export const createLogger = (service: string, options: LoggerOptions = {}): Logger =>
  pino({ ...defaultOptions, ...options }). child({ service, env: process.env.NODE_ENV || 'development' });

export const createHttpLogger = () =>
  pinoHttp({
    logger: createLogger('http'),
    autoLogging: true,
    serializers: pino.stdSerializers,
    customSuccessMessage() {
      return 'request completed';
    },
    customErrorMessage(error, res) {
      const err = error as unknown as Error;
      return `request errored: ${res.req?.method} ${res.req?.url} :: ${err?.message || 'Unknown error'}`;
    },
  });