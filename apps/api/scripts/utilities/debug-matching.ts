/**
 * Debug Matching Script
 *
 * Tests the matching algorithm against specific video titles to understand
 * why they're not matching.
 *
 * Usage: npx tsx apps/api/scripts/utilities/debug-matching.ts
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { HBCU_BANDS } from '../../src/config/hbcu-bands';

dotenv.config();
const prisma = new PrismaService();

// Test titles from unmatched videos
const TEST_TITLES = [
  'Southern University Marching Band 2017',
  'Jackson State University Marching Band - Rockstar',
  'North Carolina A&T University Marching In @ the 2019 Band Brawl',
  'Texas Southern University - Marching In to "Torture"',
  'Alcorn State "Leave Me Alone" - Marching In vs Alabama State',
  'NCCU Marching Band 2023 | Training Day Performance',
  'BCU Marching Wildcats performance @ Dutchtown High school',
  'Winston Salem State University Marching-In vs TU 2025',
  'Benedict College Homecoming Edition | Funk Phi Slide',
  'JSU "Sonic Boom of the South" - Sticky',
];

interface BandWithAliases {
  id: string;
  name: string;
  schoolName: string;
  aliases: string[];
}

async function main() {
  console.log('🔍 Debug Matching Script\n');

  // Get bands from database
  const bands = await prisma.band.findMany({
    select: { id: true, name: true, schoolName: true },
  });

  console.log(`Found ${bands.length} bands in database\n`);

  // Build HBCU config map
  const hbcuConfigMap = new Map<string, (typeof HBCU_BANDS)[0]>();
  for (const hbcu of HBCU_BANDS) {
    hbcuConfigMap.set(hbcu.school.toLowerCase(), hbcu);
  }

  // Generate aliases for all bands
  const bandsWithAliases: BandWithAliases[] = bands.map((band) => {
    const hbcuConfig = hbcuConfigMap.get(band.schoolName.toLowerCase());
    let aliases: string[] = [];

    if (hbcuConfig) {
      aliases = generateHBCUAliases(hbcuConfig);
    } else {
      aliases = [band.name.toLowerCase(), band.schoolName.toLowerCase()];
    }

    return { ...band, aliases };
  });

  // Test each title
  for (const title of TEST_TITLES) {
    console.log('='.repeat(70));
    console.log(`📹 Testing: "${title}"`);
    console.log('='.repeat(70));

    const lowerTitle = title.toLowerCase();
    const matches: { band: string; alias: string; score: number }[] = [];

    for (const band of bandsWithAliases) {
      for (const alias of band.aliases) {
        if (alias.length < 3) continue;

        let found = false;
        if (alias.length <= 4) {
          const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
          found = regex.test(lowerTitle);
        } else {
          found = lowerTitle.includes(alias);
        }

        if (found) {
          const score = calculateScore(alias, band);
          matches.push({ band: band.name, alias, score });
        }
      }
    }

    if (matches.length === 0) {
      console.log('\n❌ NO MATCHES FOUND!\n');

      // Let's see what aliases we're looking for that SHOULD match
      const possibleBands = [
        'Southern University',
        'Jackson State',
        'North Carolina A&T',
        'Texas Southern',
        'Alcorn State',
        'North Carolina Central',
        'Bethune-Cookman',
        'Winston-Salem State',
        'Benedict College',
      ];

      for (const bandName of possibleBands) {
        if (lowerTitle.includes(bandName.toLowerCase())) {
          console.log(`   ⚠️  Title contains "${bandName}" but no match found!`);

          // Find this band in our list
          const matchingBand = bandsWithAliases.find(
            (b) =>
              b.schoolName.toLowerCase().includes(bandName.toLowerCase()) ||
              b.name.toLowerCase().includes(bandName.toLowerCase())
          );

          if (matchingBand) {
            console.log(`   📋 Band exists: ${matchingBand.name}`);
            console.log(`   📋 Aliases: ${matchingBand.aliases.slice(0, 10).join(', ')}`);
          } else {
            console.log(`   ❌ Band NOT in database!`);
          }
        }
      }
    } else {
      matches.sort((a, b) => b.score - a.score);
      console.log('\n✅ MATCHES FOUND:');
      matches.slice(0, 5).forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.band} (score: ${m.score}, matched: "${m.alias}")`);
      });
    }

    console.log('');
  }

  // Also check what bands are in the database
  console.log('\n' + '='.repeat(70));
  console.log('📊 Bands in Database (sample):');
  console.log('='.repeat(70));
  bands.slice(0, 20).forEach((b) => {
    console.log(`   - ${b.name} (${b.schoolName})`);
  });
}

function generateHBCUAliases(hbcuConfig: (typeof HBCU_BANDS)[0]): string[] {
  const aliases = new Set<string>();

  aliases.add(hbcuConfig.name.toLowerCase());
  aliases.add(hbcuConfig.school.toLowerCase());

  for (const keyword of hbcuConfig.keywords) {
    aliases.add(keyword.toLowerCase());
  }

  // Extract band nickname
  const nameParts = hbcuConfig.name.split(' ');
  if (nameParts.length > 2) {
    const schoolWords = hbcuConfig.school.toLowerCase().split(' ');
    const nameWords = hbcuConfig.name.toLowerCase().split(' ');

    let nicknameStart = 0;
    for (let i = 0; i < schoolWords.length && i < nameWords.length; i++) {
      if (schoolWords[i] === nameWords[i]) {
        nicknameStart = i + 1;
      } else {
        break;
      }
    }

    if (nicknameStart > 0 && nicknameStart < nameWords.length) {
      const nickname = nameWords.slice(nicknameStart).join(' ');
      if (nickname.length > 3) {
        aliases.add(nickname);
      }
    }
  }

  // School name without "University" or "College"
  const schoolSimple = hbcuConfig.school
    .replace(/\s+university$/i, '')
    .replace(/\s+college$/i, '')
    .trim()
    .toLowerCase();

  if (schoolSimple !== hbcuConfig.school.toLowerCase()) {
    aliases.add(schoolSimple);
  }

  return Array.from(aliases);
}

// Known HBCU abbreviations that should get higher scores
const KNOWN_HBCU_ABBREVIATIONS = new Set([
  'jsu', 'tsu', 'gsu', 'asu', 'su', 'pv', 'pvamu', 'aamu', 'mvsu', 'uapb',
  'nccu', 'nsu', 'scsu', 'dsu', 'famu', 'bcu', 'ncat',
  'wssu', 'vsu', 'vuu', 'jcsu', 'ecsu', 'fsu',
  'cau', 'fvsu', 'tuskeegee', 'bcsc', 'miles', 'lane',
  'hbcu', 'swac', 'meac', 'ciaa', 'siac',
]);

function calculateScore(alias: string, band: BandWithAliases): number {
  if (alias === band.name.toLowerCase()) return 100;
  if (alias === band.schoolName.toLowerCase()) return 80;
  if (alias.length >= 8) return 60;
  if (alias.length >= 5) return 50;
  if (KNOWN_HBCU_ABBREVIATIONS.has(alias.toLowerCase())) return 55;
  return 30;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
