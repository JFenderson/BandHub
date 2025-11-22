import { Module } from '@nestjs/common';
import { BandsController } from './bands.controller';
import { BandsService } from './bands.service';
import { BandsRepository } from './bands.repository';
import { DatabaseModule } from '../../database/database.module'; // Add this import
import { CacheModule } from '../../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [DatabaseModule, CacheModule], // Add DatabaseModule here
  controllers: [BandsController],
  providers: [BandsService, BandsRepository],
  exports: [BandsService, BandsRepository],
})
export class BandsModule {}