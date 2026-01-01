import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheStrategyService } from '../cache-strategy.service';
import { CACHE_CONFIG_KEY, CacheConfig } from '../decorators/cacheable.decorator';

/**
 * CacheInterceptor
 * 
 * Automatically caches HTTP responses for methods decorated with @Cacheable
 * 
 * Apply at controller level:
 * ```ts
 * @Controller('bands')
 * @UseInterceptors(CacheInterceptor)
 * export class BandsController {
 *   @Cacheable({
 *     keyGenerator: (id: string) => `band:${id}`,
 *     ttl: 3600,
 *   })
 *   @Get(':id')
 *   async getBand(@Param('id') id: string) {
 *     return this.bandsService.findOne(id);
 *   }
 * }
 * ```
 * 
 * Note: This is optional - you can use CacheStrategyService directly
 * in services for more control.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheStrategy: CacheStrategyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get cache configuration from method decorator
    const cacheConfig = this.reflector.get<CacheConfig>(
      CACHE_CONFIG_KEY,
      context.getHandler(),
    );

    // If no cache config, pass through
    if (!cacheConfig) {
      return next.handle();
    }

    // Generate cache key from arguments
    const args = context.getArgs();
    const key = typeof cacheConfig.keyGenerator === 'function'
      ? cacheConfig.keyGenerator(...args)
      : cacheConfig.keyGenerator;

    try {
      // Try to get from cache
      const cached = await this.cacheStrategy.get(
        key,
        cacheConfig.compress ?? true,
      );

      if (cached !== null) {
        this.logger.debug(`Cache HIT (interceptor): ${key}`);
        return of(cached);
      }

      this.logger.debug(`Cache MISS (interceptor): ${key}`);

      // Cache miss - execute handler and cache result
      return next.handle().pipe(
        tap(async (response) => {
          try {
            await this.cacheStrategy.set(
              key,
              response,
              cacheConfig.ttl,
              cacheConfig.compress ?? true,
            );
          } catch (error) {
            this.logger.warn(`Failed to cache response for ${key}:`, error);
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Cache error for ${key}:`, error);
      // On error, fall back to executing handler
      return next.handle();
    }
  }
}