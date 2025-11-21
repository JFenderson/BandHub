import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CategoriesSeedService } from './seeds/categories.seed';
import { BandsSeedService } from './seeds/bands.seed';

@Module({
  imports: [],  // Only modules go here
  providers: [
    DatabaseService,
    CategoriesSeedService,  // ✅ Services go in providers
    BandsSeedService,       // ✅ Services go in providers
  ],
  exports: [
    DatabaseService,
    CategoriesSeedService,
    BandsSeedService,
  ],
})
export class DatabaseModule {}