import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module that provides PrismaService to all modules.
 * Import this in your app.module.ts to enable database access.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}