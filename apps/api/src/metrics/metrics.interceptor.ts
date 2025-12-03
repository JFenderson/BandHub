import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = process.hrtime();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // increment active connections
    this.metrics.activeHttpConnections.inc();

    return next.handle().pipe(
      tap(() => {
        const diff = process.hrtime(now);
        const durationSeconds = diff[0] + diff[1] / 1e9;
        const method = req.method || 'UNKNOWN';
        const route = req.route ? req.route.path : req.url || 'unknown_route';
        const statusCode = res.statusCode ? String(res.statusCode) : '200';

        this.metrics.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
        this.metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
        this.metrics.activeHttpConnections.dec();
      }),
    );
  }
}
