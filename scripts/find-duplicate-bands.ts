/**
 * Diagnostic Script: Find Duplicate Band Entries
 * 
 * This script identifies duplicate band entries in the database by comparing schoolName.
 * It generates a detailed report showing:
 * - Which bands are duplicates
 * - Which entries have logos, videos, colors
 * - Recommendations for merging
 * 
 * Usage: npx tsx scripts/find-duplicate-bands.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BandInfo {
  id: string;
  name: string;
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  videoCount: number;
  favoriteCount: number;
  shareCount: number;
  hasMetrics: boolean;
  createdAt: Date;
}

interface DuplicateGroup {
  schoolName: string;
  count: number;
  bands: BandInfo[];
  recommendation: string;
}

async function findDuplicateBands() {
  console.log('🔍 Scanning for duplicate band entries...\n');

  try {
    // Fetch all bands with related counts
    const bands = await prisma.band.findMany({
      include: {
        _count: {
          select: {
            videos: true,
            userFavorites: true,
            shares: true,
          },
        },
        metrics: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        schoolName: 'asc',
      },
    });

    // Group bands by schoolName
    const bandsBySchool = new Map<string, BandInfo[]>();

    for (const band of bands) {
      const bandInfo: BandInfo = {
        id: band.id,
        name: band.name,
        slug: band.slug,
        schoolName: band.schoolName,
        logoUrl: band.logoUrl,
        primaryColor: band.primaryColor,
        secondaryColor: band.secondaryColor,
        description: band.description,
        videoCount: band._count.videos,
        favoriteCount: band._count.userFavorites,
        shareCount: band._count.shares,
        hasMetrics: band.metrics !== null,
        createdAt: band.createdAt,
      };

      if (!bandsBySchool.has(band.schoolName)) {
        bandsBySchool.set(band.schoolName, []);
      }
      bandsBySchool.get(band.schoolName)!.push(bandInfo);
    }

    // Find duplicates
    const duplicates: DuplicateGroup[] = [];

    for (const [schoolName, bandsList] of Array.from(bandsBySchool.entries())) {
      if (bandsList.length > 1) {
        // Sort by completeness: bands with more data first
        const sorted = bandsList.sort((a, b) => {
          const scoreA = calculateCompletenessScore(a);
          const scoreB = calculateCompletenessScore(b);
          return scoreB - scoreA;
        });

        const primary = sorted[0];
        const duplicatesText = sorted.slice(1).map(b => b.slug).join(', ');

        duplicates.push({
          schoolName,
          count: bandsList.length,
          bands: sorted,
          recommendation: `Keep '${primary.slug}' (has ${primary.videoCount} videos, ${primary.favoriteCount} favorites). Merge duplicates: ${duplicatesText}`,
        });
      }
    }

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📊 DUPLICATE BANDS REPORT\n`);
    console.log(`Total bands: ${bands.length}`);
    console.log(`Schools with duplicates: ${duplicates.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (duplicates.length === 0) {
      console.log('✅ No duplicate bands found!\n');
      return;
    }

    // Display each duplicate group
    for (const group of duplicates) {
      console.log(`\n🎵 ${group.schoolName} (${group.count} entries)\n`);
      console.log('   Entries:\n');

      for (let i = 0; i < group.bands.length; i++) {
        const band = group.bands[i];
        const isPrimary = i === 0;
        const marker = isPrimary ? '👑' : '  ';

        console.log(`   ${marker} ${band.slug}`);
        console.log(`      ID: ${band.id}`);
        console.log(`      Logo: ${band.logoUrl ? '✅' : '❌'}`);
        console.log(`      Colors: ${band.primaryColor && band.secondaryColor ? '✅' : '❌'}`);
        console.log(`      Description: ${band.description ? '✅' : '❌'}`);
        console.log(`      Videos: ${band.videoCount}`);
        console.log(`      Favorites: ${band.favoriteCount}`);
        console.log(`      Shares: ${band.shareCount}`);
        console.log(`      Metrics: ${band.hasMetrics ? '✅' : '❌'}`);
        console.log(`      Created: ${band.createdAt.toISOString()}`);
        console.log();
      }

      console.log(`   💡 Recommendation: ${group.recommendation}\n`);
      console.log('   ─────────────────────────────────────────────────────\n');
    }

    // Export detailed report to JSON
    const reportPath = path.join(process.cwd(), 'duplicate-bands-report.json');
    const report = {
      generatedAt: new Date().toISOString(),
      totalBands: bands.length,
      duplicateSchools: duplicates.length,
      duplicates: duplicates.map(group => ({
        schoolName: group.schoolName,
        count: group.count,
        recommendation: group.recommendation,
        bands: group.bands,
      })),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
    console.log('   Next steps:');
    console.log('   1. Review the report');
    console.log('   2. Backup your database');
    console.log('   3. Run: npx tsx scripts/merge-duplicate-bands.ts\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function calculateCompletenessScore(band: BandInfo): number {
  let score = 0;

  // Videos are most important
  score += band.videoCount * 10;

  // Logo and colors
  if (band.logoUrl) score += 5;
  if (band.primaryColor && band.secondaryColor) score += 3;

  // Description
  if (band.description && band.description.length > 50) score += 2;

  // User engagement
  score += band.favoriteCount * 2;
  score += band.shareCount * 1;

  // Has metrics
  if (band.hasMetrics) score += 1;

  // Older bands get slight preference (more established)
  const ageInDays = (Date.now() - band.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  score += Math.min(ageInDays / 10, 5);

  return score;
}

// Run the script
findDuplicateBands().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
