import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CategoriesSeedService } from './seeds/categories.seed';
import { BandsSeedService } from './seeds/bands.seed';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],  // Only modules go here
  providers: [
    DatabaseService,
    CategoriesSeedService,  // ✅ Services go in providers
    BandsSeedService,       // ✅ Services go in providers
    PrismaService,
  ],
  exports: [
    DatabaseService,
    CategoriesSeedService,
    BandsSeedService,
    PrismaService,
  ],
})
export class DatabaseModule {}