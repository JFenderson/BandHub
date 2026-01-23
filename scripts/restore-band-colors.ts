/**
 * Color Restoration Script
 * 
 * This script restores primaryColor and secondaryColor fields for all bands
 * from the seed data (hbcu-bands.json). This ensures all bands have their
 * official school colors for enhanced card designs.
 * 
 * Usage: npx tsx scripts/restore-band-colors.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SeedBand {
  slug: string;
  schoolName: string;
  primaryColor?: string;
  secondaryColor?: string;
}

async function restoreBandColors() {
  console.log('🎨 Restoring band colors from seed data...\n');

  try {
    // Load seed data
    const seedDataPath = path.join(
      process.cwd(),
      'apps/api/prisma/seed-data/hbcu-bands.json'
    );

    if (!fs.existsSync(seedDataPath)) {
      throw new Error(`Seed data file not found: ${seedDataPath}`);
    }

    const seedData: SeedBand[] = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
    console.log(`📂 Loaded ${seedData.length} bands from seed data\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    let noColors = 0;

    for (const seedBand of seedData) {
      // Check if seed data has colors
      if (!seedBand.primaryColor || !seedBand.secondaryColor) {
        noColors++;
        continue;
      }

      try {
        // Find band by slug
        const band = await prisma.band.findUnique({
          where: { slug: seedBand.slug },
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            primaryColor: true,
            secondaryColor: true,
          },
        });

        if (!band) {
          console.log(`⚠️  Band not found in database: ${seedBand.slug} (${seedBand.schoolName})`);
          notFound++;
          continue;
        }

        // Check if colors are already set
        if (band.primaryColor === seedBand.primaryColor && 
            band.secondaryColor === seedBand.secondaryColor) {
          console.log(`⏭️  Already has colors: ${band.schoolName}`);
          skipped++;
          continue;
        }

        // Update colors
        await prisma.band.update({
          where: { slug: seedBand.slug },
          data: {
            primaryColor: seedBand.primaryColor,
            secondaryColor: seedBand.secondaryColor,
          },
        });

        console.log(`✅ Updated: ${band.schoolName}`);
        console.log(`   Primary: ${seedBand.primaryColor}, Secondary: ${seedBand.secondaryColor}`);
        updated++;

      } catch (error) {
        console.error(`❌ Error updating ${seedBand.slug}:`, error);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 COLOR RESTORATION SUMMARY\n');
    console.log(`   Total in seed data: ${seedData.length}`);
    console.log(`   Colors updated: ${updated}`);
    console.log(`   Already set: ${skipped}`);
    console.log(`   Not found in DB: ${notFound}`);
    console.log(`   No colors in seed: ${noColors}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (updated > 0) {
      console.log('✅ Band colors restored successfully!\n');
      console.log('   Band cards will now display with school colors.\n');
    }

  } catch (error) {
    console.error('\n❌ Error restoring colors:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
restoreBandColors().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
