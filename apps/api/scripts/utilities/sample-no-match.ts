/**
 * Sample No-Match Videos
 *
 * Shows sample video titles that passed exclusion filters but didn't match any band.
 * Helps understand if we're missing keywords or if videos genuinely have no band info.
 *
 * Usage: npx tsx apps/api/scripts/utilities/sample-no-match.ts
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { HBCU_BANDS } from '../../src/config/hbcu-bands';

dotenv.config();
const prisma = new PrismaService();

// Exclusion patterns (same as matching script)
const highSchoolPatterns = [
  'high school', 'hs band', 'h.s.', 'middle school', 'ms band',
  'elementary', 'junior high', 'jr high', 'youth band',
];

const podcastPatterns = [
  'podcast', 'interview', 'talk show', 'q&a', 'reaction',
  'review', 'commentary', 'discussion', 'debate',
];

const genericPatterns = [
  'tutorial', 'how to', 'lesson', 'practice', 'warm up',
  'exercise', 'drill', 'fundamentals', 'technique',
];

function shouldExclude(text: string): boolean {
  const lowerText = text.toLowerCase();

  for (const pattern of [...highSchoolPatterns, ...podcastPatterns, ...genericPatterns]) {
    if (lowerText.includes(pattern)) return true;
  }
  return false;
}

async function main() {
  console.log('🔍 Sampling No-Match Videos\n');

  // Get unmatched videos
  const videos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: {
      title: true,
      description: true,
      channelTitle: true,
    },
    take: 500,
  });

  // Filter to only those that pass exclusion
  const passedExclusion = videos.filter(
    (v) => !shouldExclude(`${v.title} ${v.description || ''}`)
  );

  console.log(`Total unmatched: ${videos.length}`);
  console.log(`Passed exclusion filters: ${passedExclusion.length}\n`);

  // Build band keyword set for quick lookup
  const allKeywords = new Set<string>();
  for (const band of HBCU_BANDS) {
    allKeywords.add(band.name.toLowerCase());
    allKeywords.add(band.school.toLowerCase());
    for (const kw of band.keywords) {
      if (kw.length >= 4) allKeywords.add(kw.toLowerCase());
    }
  }

  console.log('='.repeat(70));
  console.log('📹 Sample Videos That PASSED Exclusion But Didn\'t Match Any Band:');
  console.log('='.repeat(70));

  let shown = 0;
  for (const video of passedExclusion) {
    if (shown >= 30) break;

    const lowerTitle = video.title.toLowerCase();

    // Check if ANY keyword is close to being in the title
    let possibleMatch = '';
    for (const kw of allKeywords) {
      if (kw.length >= 6 && lowerTitle.includes(kw.substring(0, 5))) {
        possibleMatch = kw;
        break;
      }
    }

    console.log(`\n[${video.channelTitle}]`);
    console.log(`   Title: ${video.title}`);
    if (possibleMatch) {
      console.log(`   ⚠️  Might contain: "${possibleMatch}"`);
    }

    shown++;
  }

  // Also look for common patterns in no-match videos
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 Common Words in No-Match Titles:');
  console.log('='.repeat(70));

  const wordCounts: Record<string, number> = {};
  for (const video of passedExclusion) {
    const words = video.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length >= 4) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
  }

  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  topWords.forEach(([word, count]) => {
    console.log(`   ${word}: ${count}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
