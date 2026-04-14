// apps/api/prisma/seeders/bands.seeder.ts
import { PrismaClient, BandType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Seeder for HBCU and All-Star bands
 * 
 * This seeder handles both HBCU school bands and regional all-star bands.
 * It uses upsert operations to safely handle re-running seeds.
 * 
 * Data Sources:
 * - seed-data/hbcu-bands.json (HBCU school bands with full metadata)
 * - seed-data/all-star-bands.json (Regional all-star bands)
 */

interface BandSeedData {
  name: string;
  slug: string;
  schoolName?: string;
  nickname?: string;
  city: string | null;
  state: string;
  conference?: string;
  foundedYear?: number;
  primaryColor?: string;
  secondaryColor?: string;
  region?: string;
  aliases?: string[];
  description?: string;
  searchKeywords: string[];
  bandType: BandType;
  isActive: boolean;
  isFeatured?: boolean;
}

export async function seedBands(prisma: PrismaClient): Promise<void> {
  console.log('\n🎺 Seeding Bands...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Load data files
  const hbcuBandsPath = path.resolve(process.cwd(), 'prisma/seed-data/hbcu-bands.json');
  const allStarBandsPath = path.resolve(process.cwd(), 'prisma/seed-data/all-star-bands.json');

  const hbcuBands: BandSeedData[] = JSON.parse(fs.readFileSync(hbcuBandsPath, 'utf-8'));
  const allStarBands: BandSeedData[] = JSON.parse(fs.readFileSync(allStarBandsPath, 'utf-8'));

  console.log(`📊 Data loaded:`);
  console.log(`   • HBCU Bands: ${hbcuBands.length}`);
  console.log(`   • All-Star Bands: ${allStarBands.length}`);
  console.log(`   • Total: ${hbcuBands.length + allStarBands.length}\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Seed HBCU bands
  console.log('🏫 Seeding HBCU School Bands...\n');
  for (const band of hbcuBands) {
    try {
      const result = await upsertBand(prisma, band);
      if (result === 'created') {
        console.log('   ✅ Created:', band.name);
        created++;
      } else {
        console.log('   🔄 Updated:', band.name);
        updated++;
      }
    } catch (error) {
      console.error('   ❌ Error with', band.name + ':', error.message);
      errors++;
    }
  }

  // Seed All-Star bands
  console.log('\n⭐ Seeding All-Star Bands...\n');
  for (const band of allStarBands) {
    try {
      const result = await upsertBand(prisma, band);
      if (result === 'created') {
        console.log('   ✅ Created:', band.name);
        created++;
      } else {
        console.log('   🔄 Updated:', band.name);
        updated++;
      }
    } catch (error) {
      console.error('   ❌ Error with', band.name + ':', error.message);
      errors++;
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Bands Seeding Complete!\n');
  console.log(`📈 Results:`);
  console.log(`   • Created: ${created}`);
  console.log(`   • Updated: ${updated}`);
  console.log(`   • Errors: ${errors}`);
  console.log(`   • Total Processed: ${created + updated + errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Upsert a single band
 * Uses slug as the unique identifier
 * Returns 'created' or 'updated'
 */
async function upsertBand(
  prisma: PrismaClient,
  band: BandSeedData
): Promise<'created' | 'updated'> {
  
  // Check if band exists
  const existing = await prisma.band.findUnique({
    where: { slug: band.slug },
  });

  // Prepare data object (remove undefined fields)
  const bandData: any = {
    name: band.name,
    slug: band.slug,
    schoolName: band.schoolName || band.name, // Use name as schoolName for all-stars
    city: band.city,
    state: band.state,
    bandType: band.bandType,
    description: band.description || null,
    searchKeywords: band.searchKeywords || [],
    isActive: band.isActive,
    isFeatured: band.isFeatured || false,
  };

  // Add optional HBCU-specific fields only if they exist
  if (band.nickname) bandData.nickname = band.nickname;
  if (band.conference) bandData.conference = band.conference;
  if (band.foundedYear) bandData.foundedYear = band.foundedYear;
  if (band.primaryColor) bandData.primaryColor = band.primaryColor;
  if (band.secondaryColor) bandData.secondaryColor = band.secondaryColor;

  // Upsert the band
  await prisma.band.upsert({
    where: { slug: band.slug },
    create: bandData,
    update: bandData,
  });

  return existing ? 'updated' : 'created';
}