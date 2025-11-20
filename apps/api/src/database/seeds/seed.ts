import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { BandsSeedService } from './bands.seed';
import { CategoriesSeedService } from './categories.seed';

async function runSeeds() {
  const app = await NestFactory.create(AppModule);
  
  const bandsSeeder = app.get(BandsSeedService);
  const categoriesSeeder = app.get(CategoriesSeedService);

  console.log('🌱 Starting database seeding...');

  try {
    await categoriesSeeder.seedCategories();
    await bandsSeeder.seedBands();

    console.log('🎉 Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
  
  await app.close();
}

runSeeds().catch(console.error);