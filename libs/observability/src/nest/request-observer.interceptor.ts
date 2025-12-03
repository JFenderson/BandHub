import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { apiLatency } from '../metrics';
import { createLogger } from '../logger';
import { getCorrelationId } from '../context';

const logger = createLogger('api');

@Injectable()
export class RequestObserverInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const correlationId = getCorrelationId();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - now) / 1000;
          apiLatency
            .labels({
              route: request.route?.path || request.url,
              method: request.method,
              status_code: response.statusCode,
            })
            .observe(duration);
          logger.info({
            msg: 'request complete',
            duration,
            method: request.method,
            path: request.url,
            status: response.statusCode,
            correlationId,
          });
        },
        error: (error) => {
          const duration = (Date.now() - now) / 1000;
          logger.error(
            {
              msg: 'request failed',
              duration,
              method: request.method,
              path: request.url,
              correlationId,
            },
            error,
          );
        },
      }),
    );
  }
}
