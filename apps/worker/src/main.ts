import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('Worker');
  
  // Create the application without HTTP server
  // Workers don't need to listen for HTTP requests
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  
  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
  
  logger.log('Worker started successfully');
  logger.log('Listening for jobs on queues: video-sync, video-processing, maintenance');
}

bootstrap().catch((error) => {
  console.error('Worker failed to start', error);
  process.exit(1);
});