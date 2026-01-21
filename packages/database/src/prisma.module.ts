import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ReadReplicaService } from './read-replica.service';

/**
 * Global module that provides PrismaService and ReadReplicaService to all modules.
 * Import this in your app.module.ts to enable database access.
 *
 * ReadReplicaService provides:
 * - Automatic read/write splitting based on query type
 * - Fallback to primary database if replica is unavailable
 * - Health checks for replica connection
 */
@Global()
@Module({
  providers: [PrismaService, ReadReplicaService],
  exports: [PrismaService, ReadReplicaService],
})
export class PrismaModule {}