/**
 * Match Leftover Videos Script
 * Usage: npx tsx apps/api/scripts/match-leftovers.ts [--dry-run] [--debug]
 */

import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { HBCU_BANDS } from '../src/config/hbcu-bands';

dotenv.config();
const prisma = new PrismaService();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const debugMode = args.includes('--debug');

// 1. Helpers for normalization
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/university|college|marching|band/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// 2. Specific exclusion patterns we still want to respect (High Schools)
const STOP_WORDS = ['high school', ' hs ', 'middle school', 'elementary'];

async function main() {
  console.log('🧹 Starting Leftover Matcher...');

  // --- Load and Map Bands ---
  const dbBands = await prisma.band.findMany();
  const bandMap = new Map<string, string>(); // keyword -> bandId
  const bandIdToName = new Map<string, string>();

  let configMappedCount = 0;

  for (const dbBand of dbBands) {
    bandIdToName.set(dbBand.id, dbBand.name);

    // Add DB Name as keyword
    bandMap.set(dbBand.name.toLowerCase(), dbBand.id);
    bandMap.set(dbBand.schoolName.toLowerCase(), dbBand.id);

    // Fuzzy match DB band to Config to load extra keywords (e.g. MVSU, GSU)
    const config = HBCU_BANDS.find(c => 
      normalize(c.school) === normalize(dbBand.schoolName) ||
      normalize(c.name) === normalize(dbBand.name)
    );

    if (config) {
      configMappedCount++;
      config.keywords.forEach(k => {
        if (k.length > 2) bandMap.set(k.toLowerCase(), dbBand.id);
      });
      if (config.channelHandle) {
        bandMap.set(config.channelHandle.toLowerCase().replace('@', ''), dbBand.id);
      }
    }
  }

  console.log(`📚 Loaded ${dbBands.length} bands from DB.`);
  console.log(`🔗 Linked ${configMappedCount} bands to Config keywords.`);
  console.log(`🔑 Total matching keywords: ${bandMap.size}`);

  // --- Fetch Unmatched Videos ---
  // We specifically target videos that failed previous runs
  const videos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: { id: true, title: true, channelTitle: true, description: true },
    orderBy: { publishedAt: 'desc' },
    take: 2000 // Process in chunks if you have 23k+
  });

  console.log(`📥 Processing ${videos.length} unmatched videos...\n`);

  let matchedCount = 0;
  let skippedCount = 0;

  for (const video of videos) {
    const text = `${video.title} ${video.channelTitle} ${video.description || ''}`.toLowerCase();

    // 1. Check strict exclusions (High Schools)
    if (STOP_WORDS.some(word => text.includes(word))) {
      skippedCount++;
      continue;
    }

    // 2. Find Candidates
    const candidates = new Set<string>();
    
    // Check every keyword against the text
    for (const [keyword, bandId] of bandMap.entries()) {
      // Use boundary matching for short keywords (e.g. "su", "gsu") to avoid "super" matching "su"
      if (keyword.length <= 4) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(text)) candidates.add(bandId);
      } else {
        if (text.includes(keyword)) candidates.add(bandId);
      }
    }

    if (candidates.size === 0) {
      if (debugMode) console.log(`❌ No match: ${video.title.substring(0, 40)}...`);
      skippedCount++;
      continue;
    }

    // 3. Selection Logic
    const uniqueIds = Array.from(candidates);
    let selectedBandId = uniqueIds[0];

    // If multiple bands found (e.g. Battle), prioritize one that matches Channel Name
    if (uniqueIds.length > 1) {
      const channelOwner = uniqueIds.find(id => 
        video.channelTitle?.toLowerCase().includes(bandIdToName.get(id)?.toLowerCase() || '_____')
      );
      if (channelOwner) selectedBandId = channelOwner;
    }

    // 4. Update
    matchedCount++;
    const bandName = bandIdToName.get(selectedBandId);
    console.log(`✅ MATCH: "${video.title.substring(0, 50)}..." -> ${bandName}`);

    if (!dryRun) {
      await prisma.youTubeVideo.update({
        where: { id: video.id },
        data: { bandId: selectedBandId, qualityScore: 50 } // Mark as recovered
      });
    }
  }

  console.log('\n=====================================');
  console.log(`🏁 Done. Matched: ${matchedCount} | Skipped: ${skippedCount}`);
  if (dryRun) console.log('📋 DRY RUN: No changes applied.');
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());