
/**
 * All-Star Band Extraction Script
 *
 * Identifies all-star bands and special events from unmatched videos.
 * Generates Band profile creation data for all-star bands.
 *
 * Usage: npx tsx apps/api/scripts/extract-allstar-bands.ts
 *
 * Output: allstar-bands-report.json with bands to create
 */

import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();
const prisma = new PrismaService();

// Load all-star configuration
const allStarConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../allstar-config.json'), 'utf-8')
);

interface AllStarMatch {
  name: string;
  aliases: string[];
  region: string;
  videoCount: number;
  sampleTitles: string[];
}

interface EventMatch {
  name: string;
  type: string;
  videoCount: number;
  sampleTitles: string[];
}

interface ExtractionStats {
  totalUnmatched: number;
  allStarBandsFound: AllStarMatch[];
  eventsFound: EventMatch[];
}

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text contains all-star band
 */
function containsAllStarBand(text: string, band: any): { found: boolean; matchedAlias?: string } {
  const normalizedText = normalizeText(text);
  
  // Check exact name
  if (normalizedText.includes(normalizeText(band.name))) {
    return { found: true, matchedAlias: band.name };
  }
  
  // Check aliases
  for (const alias of band.aliases) {
    const normalizedAlias = normalizeText(alias);
    
    // For acronyms (all caps in original), use word boundary
    if (alias === alias.toUpperCase() && alias.length <= 5) {
      const regex = new RegExp(`\\b${normalizedAlias}\\b`, 'i');
      if (regex.test(normalizedText)) {
        return { found: true, matchedAlias: alias };
      }
    } else if (normalizedText.includes(normalizedAlias)) {
      return { found: true, matchedAlias: alias };
    }
  }
  
  return { found: false };
}

/**
 * Check if text contains special event
 */
function containsEvent(text: string, event: any): boolean {
  const normalizedText = normalizeText(text);
  
  // Check exact name
  if (normalizedText.includes(normalizeText(event.name))) {
    return true;
  }
  
  // Check aliases
  for (const alias of event.aliases) {
    if (normalizedText.includes(normalizeText(alias))) {
      return true;
    }
  }
  
  return false;
}

async function main() {
  console.log('🌟 All-Star Band Extraction Script');
  console.log('===================================\n');

  const stats: ExtractionStats = {
    totalUnmatched: 0,
    allStarBandsFound: [],
    eventsFound: [],
  };

  // Step 1: Get unmatched videos
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

  // Step 2: Track all-star band mentions
  const allStarMentions = new Map<string, { count: number; titles: string[] }>();
  const eventMentions = new Map<string, { count: number; titles: string[] }>();

  console.log('🔄 Scanning for all-star bands and events...\n');

  for (const video of unmatchedVideos) {
    const searchText = [
      video.title || '',
      video.description || '',
    ].join(' ');

    // Check for all-star bands
    for (const band of allStarConfig.allStarBands) {
      const match = containsAllStarBand(searchText, band);
      
      if (match.found) {
        const key = band.name;
        
        if (!allStarMentions.has(key)) {
          allStarMentions.set(key, { count: 0, titles: [] });
        }

        const mention = allStarMentions.get(key)!;
        mention.count++;
        
        // Store sample titles (max 10)
        if (mention.titles.length < 10) {
          mention.titles.push(video.title);
        }
      }
    }

    // Check for special events
    for (const event of allStarConfig.specialEvents) {
      if (containsEvent(searchText, event)) {
        const key = event.name;
        
        if (!eventMentions.has(key)) {
          eventMentions.set(key, { count: 0, titles: [] });
        }

        const mention = eventMentions.get(key)!;
        mention.count++;
        
        if (mention.titles.length < 10) {
          mention.titles.push(video.title);
        }
      }
    }
  }

  // Step 3: Compile all-star bands found
  for (const [bandName, mentions] of allStarMentions.entries()) {
    const bandData = allStarConfig.allStarBands.find((b: any) => b.name === bandName);
    
    if (bandData) {
      stats.allStarBandsFound.push({
        name: bandData.name,
        aliases: bandData.aliases,
        region: bandData.region,
        videoCount: mentions.count,
        sampleTitles: mentions.titles,
      });
    }
  }

  // Step 4: Compile events found
  for (const [eventName, mentions] of eventMentions.entries()) {
    const eventData = allStarConfig.specialEvents.find((e: any) => e.name === eventName);
    
    if (eventData) {
      stats.eventsFound.push({
        name: eventData.name,
        type: eventData.type,
        videoCount: mentions.count,
        sampleTitles: mentions.titles,
      });
    }
  }

  // Sort by video count
  stats.allStarBandsFound.sort((a, b) => b.videoCount - a.videoCount);
  stats.eventsFound.sort((a, b) => b.videoCount - a.videoCount);

  // Step 5: Print summary
  console.log('📈 Extraction Summary');
  console.log('====================');
  console.log(`Total unmatched videos scanned: ${stats.totalUnmatched}`);
  console.log(`\n🌟 All-Star Bands found: ${stats.allStarBandsFound.length}`);
  console.log(`🎪 Special Events found: ${stats.eventsFound.length}\n`);

  if (stats.allStarBandsFound.length > 0) {
    console.log('🌟 All-Star Bands Detected:');
    console.log('===========================\n');

    for (const band of stats.allStarBandsFound) {
      console.log(`🎺 ${band.name}`);
      console.log(`   Region: ${band.region}`);
      console.log(`   Videos found: ${band.videoCount}`);
      console.log(`   Aliases: ${band.aliases.join(', ')}`);
      console.log(`   Sample titles:`);
      band.sampleTitles.slice(0, 3).forEach((title) => {
        console.log(`     - ${title}`);
      });
      console.log('');
    }
  }

  if (stats.eventsFound.length > 0) {
    console.log('\n🎪 Special Events Detected:');
    console.log('==========================\n');

    for (const event of stats.eventsFound) {
      console.log(`📅 ${event.name} (${event.type})`);
      console.log(`   Videos found: ${event.videoCount}`);
      console.log(`   Sample titles:`);
      event.sampleTitles.slice(0, 2).forEach((title) => {
        console.log(`     - ${title}`);
      });
      console.log('');
    }
  }

  // Export detailed report
  const reportPath = path.resolve(process.cwd(), 'allstar-bands-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n💾 Full report exported to: ${reportPath}`);

  // Generate Band creation template for all-star bands
  if (stats.allStarBandsFound.length > 0) {
    console.log('\n📝 Generating All-Star Band creation template...');
    
    const bandCreationTemplate = stats.allStarBandsFound.map((band) => ({
      name: band.name,
      schoolName: band.name, // All-star bands use same name for both
      city: band.region.split(',')[0].trim(), // Extract city from region
      state: band.region.includes(',') ? band.region.split(',')[1].trim() : '',
      bandType: 'ALL_STAR',
      conference: null,
      description: `${band.name} is an all-star marching band featuring talented musicians from the ${band.region} region.`,
      foundedYear: null,
      youtubeChannelId: null,
      searchKeywords: band.aliases,
      isActive: true,
      isFeatured: false,
    }));

    const templatePath = path.resolve(process.cwd(), 'allstar-bands-to-create.json');
    fs.writeFileSync(templatePath, JSON.stringify(bandCreationTemplate, null, 2));
    console.log(`   Template saved to: ${templatePath}`);
    console.log('\n   ⚠️  NOTE: Before creating these Band records:');
    console.log('   1. Add "bandType" field to your Prisma schema');
    console.log('   2. Run prisma migrate to update database');
    console.log('   3. Review and adjust any details as needed');
  }

  console.log('\n✅ Extraction complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });