import { LoggerService } from '@nestjs/common';
import { createLogger } from './logger';
import { Logger as PinoLogger } from 'pino';

export class NestPinoLogger implements LoggerService {
  private logger: PinoLogger;

  constructor(context: string) {
    this.logger = createLogger(context);
  }

  log(message: any, ... optionalParams: any[]) {
    this.logger. info(message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this. logger.error(message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.trace(message, ...optionalParams);
  }
}