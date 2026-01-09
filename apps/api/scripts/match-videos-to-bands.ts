/**
 * Video-to-Band Matching Script
 *
 * Matches YouTubeVideo records to bands by analyzing video metadata.
 * Fetches all bands from the database and generates comprehensive aliases for matching.
 *
 * Usage: npx tsx apps/api/scripts/match-videos-to-bands.ts [options]
 *
 * Options:
 *   --dry-run              Preview without making changes
 *   --limit <number>       Process limited videos
 *   --min-confidence <n>   Minimum confidence score (0-100)
 */

import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
dotenv.config();
const prisma = new PrismaService();

// Parse command line arguments with validation
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function parseIntArg(argName: string, defaultValue: number, min?: number, max?: number): number {
  const index = args.indexOf(argName);
  if (index === -1 || index + 1 >= args.length) {
    return defaultValue;
  }
  const value = parseInt(args[index + 1], 10);
  if (isNaN(value)) {
    console.warn(`⚠️  Invalid ${argName} value, using default: ${defaultValue}`);
    return defaultValue;
  }
  if (min !== undefined && value < min) {
    console.warn(`⚠️  ${argName} must be >= ${min}, using: ${min}`);
    return min;
  }
  if (max !== undefined && value > max) {
    console.warn(`⚠️  ${argName} must be <= ${max}, using: ${max}`);
    return max;
  }
  return value;
}

const processLimit = parseIntArg('--limit', Infinity, 1);
const minConfidence = parseIntArg('--min-confidence', 30, 0, 100);

// State name abbreviations for alias generation
const stateAbbreviations: Record<string, string[]> = {
  AL: ['Alabama', 'Bama'],
  AR: ['Arkansas'],
  DE: ['Delaware'],
  DC: ['Washington DC', 'D.C.', 'DC'],
  FL: ['Florida', 'Fla'],
  GA: ['Georgia'],
  LA: ['Louisiana'],
  MD: ['Maryland'],
  MS: ['Mississippi', 'Miss'],
  NC: ['North Carolina', 'N.C.'],
  OH: ['Ohio'],
  OK: ['Oklahoma'],
  SC: ['South Carolina', 'S.C.'],
  TN: ['Tennessee', 'Tenn'],
  TX: ['Texas'],
  VA: ['Virginia'],
};

// Battle detection keywords (case-insensitive)
const battleKeywords = [
  ' vs ',
  ' vs. ',
  ' v. ',
  ' v ',
  ' versus ',
  'battle',
  'botb',
  'band battle',
  'battle of the bands',
  'showdown',
  'face off',
  'faceoff',
];

interface BandWithAliases {
  id: string;
  name: string;
  schoolName: string;
  state: string;
  aliases: string[];
}

interface MatchResult {
  bandId: string;
  bandName: string;
  score: number;
  matchedAlias: string;
  matchType: 'exact_band_name' | 'school_name' | 'partial' | 'abbreviation';
}

interface VideoMatchStats {
  totalProcessed: number;
  matchedWithConfidence: number;
  singleBand: number;
  battleVideos: number;
  noMatch: number;
  lowConfidence: number;
  bandCounts: Map<string, number>;
}

/**
 * Generate comprehensive aliases from band data
 */
function generateAliases(band: { name: string; schoolName: string; state: string }): string[] {
  const aliases: string[] = [];

  // Add exact band name
  aliases.push(band.name.toLowerCase());

  // Add band name parts (e.g., "Sonic Boom" from "Sonic Boom of the South")
  const bandNameParts = band.name
    .replace(/\s+of\s+the\s+/gi, ' ')
    .replace(/\s+of\s+/gi, ' ')
    .split(' ')
    .filter((p) => p.length > 2 && !['the', 'and'].includes(p.toLowerCase()));
  if (bandNameParts.length >= 2) {
    // First two significant words
    aliases.push(bandNameParts.slice(0, 2).join(' ').toLowerCase());
    // First three significant words if available
    if (bandNameParts.length >= 3) {
      aliases.push(bandNameParts.slice(0, 3).join(' ').toLowerCase());
    }
  }

  // Special nickname patterns from band names
  const nameUpper = band.name.toUpperCase();
  if (nameUpper.includes('SONIC BOOM')) {
    aliases.push('sonic boom', 'boom');
  }
  if (nameUpper.includes('MARCHING 100') || nameUpper === 'MARCHING 100') {
    aliases.push('marching 100', 'the 100', 'famu marching');
  }
  if (nameUpper.includes('HUMAN JUKEBOX')) {
    aliases.push('human jukebox', 'jukebox', 'the jukebox');
  }
  if (nameUpper.includes('WORLD FAMED')) {
    aliases.push('world famed', 'tiger band', 'grambling band');
  }
  if (nameUpper.includes('101') && !nameUpper.includes('MARCHING 100')) {
    aliases.push('101', 'the 101', '101 band');
  }
  if (nameUpper.includes('SHOWTIME')) {
    aliases.push('showtime', 'showtime band');
  }
  if (nameUpper.includes('ARISTOCRAT')) {
    aliases.push('aristocrat', 'aristocrat of bands');
  }
  if (nameUpper.includes('OCEAN OF SOUL')) {
    aliases.push('ocean of soul', 'oos', 'ocean');
  }
  if (nameUpper.includes('MARCHING STORM')) {
    aliases.push('marching storm', 'the storm');
  }

  // Add full school name
  aliases.push(band.schoolName.toLowerCase());

  // School name without "University" or "College"
  const schoolWithoutUniversity = band.schoolName
    .replace(/\s+university$/i, '')
    .replace(/\s+college$/i, '')
    .replace(/\s+state$/i, ' state')
    .trim()
    .toLowerCase();
  if (schoolWithoutUniversity !== band.schoolName.toLowerCase()) {
    aliases.push(schoolWithoutUniversity);
  }

  // Generate acronyms from school name
  const schoolWords = band.schoolName
    .replace(/&/g, 'and')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Full acronym (e.g., JSU, FAMU, NCAT)
  const fullAcronym = schoolWords
    .filter((w) => !['of', 'the', 'at', 'and'].includes(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  if (fullAcronym.length >= 2) {
    aliases.push(fullAcronym.toLowerCase());
  }

  // Handle A&M, A&T patterns
  if (band.schoolName.includes('A&M')) {
    aliases.push(band.schoolName.replace('A&M', 'A and M').toLowerCase());

    // Extract the prefix before A&M for acronyms like PVAMU
    const amMatch = band.schoolName.match(/(.+?)\s*A&M/i);
    if (amMatch) {
      const prefix = amMatch[1].trim();
      const prefixWords = prefix.split(/\s+/);
      if (prefixWords.length >= 2) {
        // e.g., "Prairie View" -> "PV"
        const prefixAcronym = prefixWords.map((w) => w[0]).join('');
        aliases.push(`${prefixAcronym}AMU`.toLowerCase());
        aliases.push(`${prefixAcronym}AM`.toLowerCase());
        aliases.push(`${prefixAcronym} A&M`.toLowerCase());
      } else if (prefixWords.length === 1) {
        // e.g., "Alabama" -> just use state abbreviation
        const stateAbbr = Object.entries(stateAbbreviations).find(([abbr, names]) =>
          names.some((n) => n.toLowerCase() === prefix.toLowerCase()),
        );
        if (stateAbbr) {
          aliases.push(`${stateAbbr[0]}AM`.toLowerCase());
          aliases.push(`${stateAbbr[0]}AMU`.toLowerCase());
        }
      }
    }
  }

  if (band.schoolName.includes('A&T')) {
    aliases.push(band.schoolName.replace('A&T', 'A and T').toLowerCase());

    // Handle NC A&T specifically
    if (band.schoolName.includes('North Carolina A&T')) {
      aliases.push('nc a&t', 'ncat', 'nc at', 'a&t', 'north carolina a&t');
    }
  }

  // Handle "State University" patterns
  if (band.schoolName.includes('State University')) {
    const stateMatch = band.schoolName.match(/(.+?)\s+State\s+University/i);
    if (stateMatch) {
      const stateName = stateMatch[1].trim();
      aliases.push(`${stateName} state`.toLowerCase());
      aliases.push(`${stateName} st`.toLowerCase());

      // Single word state name -> abbreviation (e.g., "Jackson" -> "JSU")
      const stateWords = stateName.split(/\s+/);
      if (stateWords.length === 1) {
        aliases.push(`${stateName[0]}SU`.toLowerCase());
        aliases.push(`${stateName[0]}-state`.toLowerCase());
      } else {
        // Multi-word state -> acronym + SU
        const acronym = stateWords.map((w) => w[0]).join('');
        aliases.push(`${acronym}SU`.toLowerCase());
      }
    }
  }

  // Handle "University of X at Y" patterns (e.g., University of Arkansas at Pine Bluff)
  const uofMatch = band.schoolName.match(/university\s+of\s+(.+?)\s+at\s+(.+)/i);
  if (uofMatch) {
    const [, state, location] = uofMatch;
    const locationAcronym = location
      .split(/\s+/)
      .map((w) => w[0])
      .join('');
    const stateAbbr = Object.entries(stateAbbreviations).find(([, names]) =>
      names.some((n) => n.toLowerCase() === state.toLowerCase()),
    );
    if (stateAbbr) {
      aliases.push(`UA${locationAcronym}`.toLowerCase());
      aliases.push(`${stateAbbr[0]}${locationAcronym}`.toLowerCase());
    }
    aliases.push(location.toLowerCase());
    aliases.push(`${state} ${location}`.toLowerCase());
  }

  // Special school-specific aliases
  // NOTE: We use unique prefixes for short aliases to avoid conflicts
  // between schools with similar abbreviations
  const schoolUpper = band.schoolName.toUpperCase();
  if (schoolUpper.includes('JACKSON STATE')) {
    aliases.push('jsu', 'j-state', 'jackson st', 'jackson');
  }
  if (schoolUpper.includes('SOUTHERN UNIVERSITY')) {
    // Use 'subr' (Southern University Baton Rouge) to differentiate
    aliases.push('subr', 'southern', 'southern u', 'southern university baton rouge');
  }
  if (schoolUpper.includes('FLORIDA A&M')) {
    aliases.push('famu', 'florida am', 'florida a&m', 'fam');
  }
  if (schoolUpper.includes('GRAMBLING')) {
    aliases.push('gsu', 'grambling', 'grambling st');
  }
  if (schoolUpper.includes('HOWARD')) {
    aliases.push('howard', 'howard u', 'howard university');
  }
  if (schoolUpper.includes('TENNESSEE STATE')) {
    // Use 'tnsu' to differentiate from Texas Southern
    aliases.push('tnsu', 'tennessee st', 'tn state', 'tennessee state');
  }
  if (schoolUpper.includes('TEXAS SOUTHERN')) {
    aliases.push('txsu', 'texas southern', 'tx southern');
  }
  if (schoolUpper.includes('PRAIRIE VIEW')) {
    aliases.push('pvamu', 'pv', 'prairie view');
  }
  if (schoolUpper.includes('NORFOLK STATE')) {
    aliases.push('nsu', 'norfolk', 'norfolk st');
  }
  if (schoolUpper.includes('HAMPTON')) {
    aliases.push('hampton', 'hampton u', 'hampton university');
  }
  if (schoolUpper.includes('MORGAN STATE')) {
    aliases.push('msu', 'morgan', 'morgan st');
  }
  if (schoolUpper.includes('SOUTH CAROLINA STATE')) {
    aliases.push('scsu', 'sc state', 'south carolina st');
  }
  if (schoolUpper.includes('BETHUNE-COOKMAN') || schoolUpper.includes('BETHUNE COOKMAN')) {
    aliases.push('bcu', 'b-cu', 'bethune', 'bethune cookman');
  }
  if (schoolUpper.includes('ALABAMA A&M')) {
    aliases.push('aamu', 'alabama am');
  }
  if (schoolUpper.includes('ALABAMA STATE')) {
    // Use 'alasu' to differentiate from other state schools
    aliases.push('alasu', 'bama state', 'alabama st', 'alabama state');
  }
  if (schoolUpper.includes('ALCORN')) {
    aliases.push('alcorn', 'alcorn st', 'alcorn state');
  }
  if (schoolUpper.includes('MISSISSIPPI VALLEY')) {
    aliases.push('mvsu', 'valley', 'miss valley');
  }
  if (schoolUpper.includes('NORTH CAROLINA CENTRAL')) {
    aliases.push('nccu', 'ncc', 'central');
  }
  if (schoolUpper.includes('WINSTON-SALEM') || schoolUpper.includes('WINSTON SALEM')) {
    aliases.push('wssu', 'winston salem', 'winston-salem');
  }
  if (schoolUpper.includes('FAYETTEVILLE STATE')) {
    // Use 'faysu' to differentiate from Florida State
    aliases.push('faysu', 'fayetteville', 'fayetteville state');
  }
  if (schoolUpper.includes('CLARK ATLANTA')) {
    aliases.push('cau', 'clark', 'clark atlanta');
  }
  if (schoolUpper.includes('MOREHOUSE')) {
    aliases.push('morehouse', 'house');
  }
  if (schoolUpper.includes('BOWIE STATE')) {
    // Use 'bowsu' to differentiate
    aliases.push('bowsu', 'bowie', 'bowie state');
  }
  if (schoolUpper.includes('DELAWARE STATE')) {
    aliases.push('desu', 'delaware', 'del state');
  }
  if (schoolUpper.includes('CENTRAL STATE')) {
    // Use 'csosu' for Central State of Ohio to differentiate
    aliases.push('csosu', 'central state', 'central state ohio');
  }
  if (schoolUpper.includes('LANGSTON')) {
    aliases.push('langston', 'langston university');
  }
  if (schoolUpper.includes('TUSKEGEE')) {
    aliases.push('tuskegee', 'tuskegee university');
  }
  if (schoolUpper.includes('MILES COLLEGE')) {
    aliases.push('miles', 'miles college');
  }
  if (schoolUpper.includes('ALBANY STATE')) {
    // Use 'albysu' to differentiate from Alabama State
    aliases.push('albysu', 'albany', 'albany state');
  }
  if (schoolUpper.includes('FORT VALLEY')) {
    aliases.push('fvsu', 'fort valley');
  }
  if (schoolUpper.includes('SAVANNAH STATE')) {
    aliases.push('ssu', 'savannah');
  }
  if (schoolUpper.includes('ELIZABETH CITY')) {
    aliases.push('ecsu', 'elizabeth city');
  }
  if (schoolUpper.includes('VIRGINIA STATE')) {
    // Use 'vasu' to differentiate from Valdosta State
    aliases.push('vasu', 'va state', 'virginia st', 'virginia state');
  }

  // Remove duplicates and empty strings
  const uniqueAliases = Array.from(new Set(aliases.filter((a) => a.trim().length > 0)));

  return uniqueAliases;
}

/**
 * Check if text contains battle keywords
 */
function isBattleVideo(text: string): boolean {
  const lowerText = text.toLowerCase();
  return battleKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Find matches for a video against all bands
 */
function findMatches(
  searchText: string,
  bandsWithAliases: BandWithAliases[],
): MatchResult[] {
  const matches: MatchResult[] = [];
  const lowerText = searchText.toLowerCase();

  for (const band of bandsWithAliases) {
    let bestScore = 0;
    let bestAlias = '';
    let bestMatchType: MatchResult['matchType'] = 'abbreviation';

    for (const alias of band.aliases) {
      // Skip very short aliases (2 chars or less) that might cause false positives
      // Minimum 3 characters required for matching
      if (alias.length < 3) continue;

      // Check if alias appears in text
      // Use word boundary matching for short aliases (3-4 chars)
      let found = false;
      if (alias.length <= 4) {
        // For short aliases like JSU, FAMU, use strict word boundary
        const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        found = regex.test(lowerText);
      } else {
        found = lowerText.includes(alias);
      }

      if (found) {
        let score = 0;
        let matchType: MatchResult['matchType'] = 'abbreviation';

        // Score based on match type
        if (alias === band.name.toLowerCase()) {
          score = 100;
          matchType = 'exact_band_name';
        } else if (alias === band.schoolName.toLowerCase()) {
          score = 80;
          matchType = 'school_name';
        } else if (alias.length >= 8) {
          // Longer partial matches (e.g., "Jackson State", "Human Jukebox")
          score = 60;
          matchType = 'partial';
        } else if (alias.length >= 5) {
          // Medium partial matches
          score = 50;
          matchType = 'partial';
        } else {
          // Short aliases / abbreviations
          score = 30;
          matchType = 'abbreviation';
        }

        // Boost score if found in title (first 200 chars typically)
        if (lowerText.substring(0, 200).includes(alias)) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
          bestMatchType = matchType;
        }
      }
    }

    if (bestScore > 0) {
      matches.push({
        bandId: band.id,
        bandName: band.name,
        score: bestScore,
        matchedAlias: bestAlias,
        matchType: bestMatchType,
      });
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main matching function
 */
async function main() {
  console.log('🎯 Video-to-Band Matching Script');
  console.log('================================\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  console.log(`⚙️  Configuration:`);
  console.log(`   Min Confidence: ${minConfidence}`);
  console.log(`   Process Limit: ${processLimit === Infinity ? 'All' : processLimit}\n`);

  // Fetch all active bands
  console.log('📊 Fetching bands from database...');
  const bands = await prisma.band.findMany({
    select: {
      id: true,
      name: true,
      schoolName: true,
      state: true,
    },
  });

  console.log(`   Found ${bands.length} active bands\n`);

  // Generate aliases for all bands
  console.log('🔧 Generating aliases for bands...');
  const bandsWithAliases: BandWithAliases[] = bands.map((band) => ({
    ...band,
    aliases: generateAliases(band),
  }));

  // Log sample aliases for debugging
  console.log('\n📝 Sample alias generation:');
  for (const band of bandsWithAliases.slice(0, 3)) {
    console.log(`   ${band.name}:`);
    console.log(`     ${band.aliases.slice(0, 8).join(', ')}${band.aliases.length > 8 ? '...' : ''}`);
  }
  console.log('');

  // Fetch unmatched videos (videos without bandId)
  console.log('📥 Fetching videos to match...');
  const videosQuery = {
    where: {
      bandId: null as string | null,
    },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      description: true,
      channelTitle: true,
    },
    take: processLimit === Infinity ? undefined : processLimit,
    orderBy: { createdAt: 'desc' as const },
  };

  const videos = await prisma.youTubeVideo.findMany(videosQuery);
  console.log(`   Found ${videos.length} unmatched videos\n`);

  if (videos.length === 0) {
    console.log('✅ No unmatched videos to process');
    return;
  }

  // Statistics tracking
  const stats: VideoMatchStats = {
    totalProcessed: 0,
    matchedWithConfidence: 0,
    singleBand: 0,
    battleVideos: 0,
    noMatch: 0,
    lowConfidence: 0,
    bandCounts: new Map(),
  };

  // Process videos
  console.log('🔄 Processing videos...\n');

  for (const video of videos) {
    stats.totalProcessed++;

    // Combine searchable text
    const searchText = [
      video.title || '',
      video.description || '',
      video.channelTitle || '',
    ].join(' ');

    // Find matches
    const matches = findMatches(searchText, bandsWithAliases);

    if (matches.length === 0) {
      stats.noMatch++;
      continue;
    }

    const topMatch = matches[0];

    // Check confidence threshold
    if (topMatch.score < minConfidence) {
      stats.lowConfidence++;
      continue;
    }

    // Check for battle video
    const isBattle = isBattleVideo(searchText);

    if (isBattle && matches.length >= 2) {
      // Find second band for battle video
      const secondMatch = matches.find((m) => m.bandId !== topMatch.bandId);
      if (secondMatch && secondMatch.score >= minConfidence) {
        stats.battleVideos++;
        // Note: YouTubeVideo model doesn't have opponentBandId field (only Video model does)
        // Battle opponent info is detected and tracked for statistics only
        // When videos are promoted to Video table, opponent can be set then
      } else {
        stats.singleBand++;
      }
    } else {
      stats.singleBand++;
    }

    stats.matchedWithConfidence++;

    // Track band counts
    const currentCount = stats.bandCounts.get(topMatch.bandName) || 0;
    stats.bandCounts.set(topMatch.bandName, currentCount + 1);

    // Update database (if not dry run)
    if (!dryRun) {
      try {
        await prisma.youTubeVideo.update({
          where: { id: video.id },
          data: {
            bandId: topMatch.bandId,
            // Store match confidence as quality score
            qualityScore: topMatch.score,
          },
        });
      } catch (error) {
        console.error(`   ❌ Error updating video ${video.youtubeId}: ${error}`);
      }
    }

    // Progress update every 100 videos
    if (stats.totalProcessed % 100 === 0) {
      console.log(
        `   Processed ${stats.totalProcessed}/${videos.length} videos... (${stats.matchedWithConfidence} matched)`,
      );
    }
  }

  // Print summary
  console.log('\n🎯 Video Matching Summary');
  console.log('========================');
  console.log(`Total videos processed: ${stats.totalProcessed}`);
  console.log(`✅ Matched with confidence: ${stats.matchedWithConfidence}`);
  console.log(`   - Single band: ${stats.singleBand}`);
  console.log(`   ⚔️ Battle (2 bands): ${stats.battleVideos}`);
  console.log(`❓ No match: ${stats.noMatch}`);
  console.log(`⚠️ Low confidence (< ${minConfidence}): ${stats.lowConfidence}`);

  // Calculate match rate
  const matchRate = stats.totalProcessed > 0
    ? ((stats.matchedWithConfidence / stats.totalProcessed) * 100).toFixed(1)
    : '0';
  console.log(`\n📈 Match Rate: ${matchRate}%`);

  // Top matched bands
  if (stats.bandCounts.size > 0) {
    console.log('\n🏆 Top matched bands:');
    const sortedBands = Array.from(stats.bandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedBands.forEach(([name, count], index) => {
      console.log(`   ${index + 1}. ${name} - ${count} videos`);
    });
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes were made');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log(`\n✅ Updated ${stats.matchedWithConfidence} videos with band assignments`);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
