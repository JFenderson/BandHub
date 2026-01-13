// Current path in scripts:
import { HBCU_BANDS } from '../src/config/hbcu-bands';

/**
 * Missing HBCU Discovery Script - V2
 *
 * Uses your existing hbcu-bands.ts configuration to find missing bands.
 * Analyzes unmatched videos to find HBCUs not yet in the database.
 *
 * Usage: npx tsx apps/api/scripts/discover-missing-hbcus.ts
 *
 * Output: missing-hbcus-report.json with HBCUs to add
 */

import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();
const prisma = new PrismaService();

interface HBCUMatch {
  bandName: string;
  schoolName: string;
  city: string;
  state: string;
  conference: string;
  videoCount: number;
  sampleTitles: string[];
  keywords: string[];
  channelHandle?: string;
}

interface DiscoveryStats {
  totalUnmatched: number;
  totalHBCUsInConfig: number;
  totalHBCUsInDatabase: number;
  missingHBCUs: HBCUMatch[];
  hbcusAlreadyInDB: string[];
}

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract conference from HBCU_BANDS based on position
 */
function getConference(index: number): string {
  // Based on your file structure
  if (index >= 0 && index <= 11) return 'SWAC';
  if (index >= 12 && index <= 17) return 'MEAC';
  if (index >= 18 && index <= 28) return 'CIAA';
  if (index >= 29 && index <= 40) return 'SIAC';
  if (index >= 41 && index <= 42) return 'CAA';
  if (index === 43) return 'OVC';
  return 'Independent';
}

/**
 * Check if text contains HBCU based on keywords and names
 */
function containsHBCU(text: string, hbcu: any): boolean {
  const normalizedText = normalizeText(text);
  
  // Check band name
  if (normalizedText.includes(normalizeText(hbcu.name))) {
    return true;
  }
  
  // Check school name
  if (normalizedText.includes(normalizeText(hbcu.school))) {
    return true;
  }
  
  // Check keywords
  for (const keyword of hbcu.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    // For short keywords (3-4 chars), use word boundary
    if (normalizedKeyword.length <= 4) {
      const regex = new RegExp(`\\b${normalizedKeyword}\\b`, 'i');
      if (regex.test(normalizedText)) {
        return true;
      }
    } else {
      if (normalizedText.includes(normalizedKeyword)) {
        return true;
      }
    }
  }
  
  return false;
}

async function main() {
  console.log('🔍 Missing HBCU Discovery Script (V2)');
  console.log('=====================================\n');

  const stats: DiscoveryStats = {
    totalUnmatched: 0,
    totalHBCUsInConfig: HBCU_BANDS.length,
    totalHBCUsInDatabase: 0,
    missingHBCUs: [],
    hbcusAlreadyInDB: [],
  };

  console.log(`📊 HBCU Configuration:`);
  console.log(`   Total HBCUs in config: ${stats.totalHBCUsInConfig}\n`);

  // Step 1: Get all bands currently in database
  console.log('📊 Fetching existing bands from database...');
  const existingBands = await prisma.band.findMany({
    select: {
      name: true,
      schoolName: true,
    },
  });

  stats.totalHBCUsInDatabase = existingBands.length;
  console.log(`   Found ${stats.totalHBCUsInDatabase} bands in database\n`);

  // Create set of existing school names for quick lookup
  const existingSchoolNames = new Set(
    existingBands.map((b) => normalizeText(b.schoolName))
  );

  // Step 2: Get all unmatched videos
  console.log('📥 Fetching unmatched videos...');
  const unmatchedVideos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: {
      id: true,
      title: true,
      description: true,
      channelTitle: true,
    },
  });

  stats.totalUnmatched = unmatchedVideos.length;
  console.log(`   Found ${stats.totalUnmatched} unmatched videos\n`);

  // Step 3: Track HBCU mentions
  const hbcuMentions = new Map<string, { count: number; titles: string[] }>();

  console.log('🔄 Analyzing videos for HBCU mentions...\n');

  for (const video of unmatchedVideos) {
    const searchText = [
      video.title || '',
      video.description || '',
      video.channelTitle || '',
    ].join(' ');

    for (const hbcu of HBCU_BANDS) {
      if (containsHBCU(searchText, hbcu)) {
        const key = hbcu.school; // Use school name as key
        
        if (!hbcuMentions.has(key)) {
          hbcuMentions.set(key, { count: 0, titles: [] });
        }

        const mention = hbcuMentions.get(key)!;
        mention.count++;
        
        // Store sample titles (max 5)
        if (mention.titles.length < 5) {
          mention.titles.push(video.title);
        }
      }
    }
  }

  // Step 4: Identify missing HBCUs
  console.log('📋 Identifying missing HBCUs...\n');

  for (const [schoolName, mentions] of hbcuMentions.entries()) {
    const hbcuIndex = HBCU_BANDS.findIndex((h) => h.school === schoolName);
    const hbcuData = HBCU_BANDS[hbcuIndex];
    
    if (!hbcuData) continue;

    const isInDatabase = existingSchoolNames.has(normalizeText(hbcuData.school));

    if (isInDatabase) {
      stats.hbcusAlreadyInDB.push(schoolName);
    } else {
      // This is a missing HBCU!
      stats.missingHBCUs.push({
        bandName: hbcuData.name,
        schoolName: hbcuData.school,
        city: hbcuData.city,
        state: hbcuData.state,
        conference: getConference(hbcuIndex),
        videoCount: mentions.count,
        sampleTitles: mentions.titles,
        keywords: hbcuData.keywords,
        channelHandle: hbcuData.channelHandle,
      });
    }
  }

  // Sort missing HBCUs by video count
  stats.missingHBCUs.sort((a, b) => b.videoCount - a.videoCount);

  // Step 5: Print summary
  console.log('📈 Discovery Summary');
  console.log('===================');
  console.log(`Total unmatched videos: ${stats.totalUnmatched}`);
  console.log(`Total HBCUs in config: ${stats.totalHBCUsInConfig}`);
  console.log(`Total bands in database: ${stats.totalHBCUsInDatabase}`);
  console.log(`\n✅ HBCUs already in database: ${stats.hbcusAlreadyInDB.length}`);
  console.log(`⚠️  Missing HBCUs found: ${stats.missingHBCUs.length}\n`);

  if (stats.missingHBCUs.length > 0) {
    console.log('🎯 Missing HBCUs (sorted by video count):');
    console.log('==========================================\n');

    for (const missing of stats.missingHBCUs) {
      console.log(`📍 ${missing.bandName}`);
      console.log(`   School: ${missing.schoolName}`);
      console.log(`   Location: ${missing.city}, ${missing.state}`);
      console.log(`   Conference: ${missing.conference}`);
      console.log(`   Videos found: ${missing.videoCount}`);
      if (missing.channelHandle) {
        console.log(`   YouTube: ${missing.channelHandle}`);
      }
      console.log(`   Sample titles:`);
      missing.sampleTitles.forEach((title) => {
        console.log(`     - ${title}`);
      });
      console.log('');
    }

    // Export detailed report
    const reportPath = path.resolve(process.cwd(), 'missing-hbcus-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n💾 Full report exported to: ${reportPath}`);
    
    // Generate Band creation template
    console.log('\n📝 Generating Band creation template...');
    const bandCreationTemplate = stats.missingHBCUs.map((missing) => ({
      name: missing.bandName,
      schoolName: missing.schoolName,
      city: missing.city,
      state: missing.state,
      bandType: 'HBCU',
      conference: missing.conference,
      description: `${missing.bandName} represents ${missing.schoolName} in ${missing.city}, ${missing.state}.`,
      foundedYear: null, // To be filled in
      youtubeChannelId: null, // Extract from channelHandle if needed
      channelHandle: missing.channelHandle,
      searchKeywords: missing.keywords,
      isActive: true,
      isFeatured: false,
    }));

    const templatePath = path.resolve(process.cwd(), 'bands-to-create.json');
    fs.writeFileSync(templatePath, JSON.stringify(bandCreationTemplate, null, 2));
    console.log(`   Template saved to: ${templatePath}`);
    console.log('\n✅ Ready to create Band records!');
    console.log('   Review the template and run your seed script');
  } else {
    console.log('✅ All HBCUs from unmatched videos are already in the database!');
  }

  console.log('\n✅ Discovery complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });