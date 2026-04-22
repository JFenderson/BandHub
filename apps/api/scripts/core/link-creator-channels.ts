/**
 * Link Creator Channels Script
 *
 * Populates Band.youtubeChannelId for bands that have official YouTube channels
 * registered as ContentCreator records. Once populated, the match-videos script
 * Stage 0 (channel ownership) will instantly match all videos from those channels
 * at 100% confidence — no alias or AI matching needed.
 *
 * Run in dry-run mode first (default), then with --apply to save.
 *
 * Usage:
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/link-creator-channels.ts
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/link-creator-channels.ts --apply
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../apps/api/.env') });
dotenv.config();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Official band channels — ContentCreator.youtubeChannelId → band school name
// These are channels operated by the band / university directly.
// Independent videographers (Killa Kev, ShowtimeWeb, etc.) are intentionally
// excluded because they post videos of many different bands.
// ---------------------------------------------------------------------------

const OFFICIAL_CHANNELS: Array<{ channelId: string; schoolName: string; creatorName: string }> = [
  { channelId: 'UCk3tHPULjkpwMVkyNN0Z02Q', schoolName: 'Jackson State University',             creatorName: 'JSU Bands' },
  { channelId: 'UC6VM7jSjZ7D4nF1DCJ2w-Gw', schoolName: 'Southern University',                  creatorName: 'Human Jukebox Media' },
  { channelId: 'UCWeUjEMXg_IjJvuk5Dm7-zQ', schoolName: 'Alabama A&M University',               creatorName: 'AAMU Marching Maroon & White' },
  { channelId: 'UCOYj1hOj0uZPIWuCrCt2J8Q', schoolName: 'Norfolk State University',             creatorName: 'Norfolk State Spartan Legion' },
  { channelId: 'UC9slanCMZWrSn7UUHRYc7OA', schoolName: 'Tuskegee University',                  creatorName: 'Crimson Piper Media' },
  { channelId: 'UCSduiMl4sz1tCnb5X-axBjQ', schoolName: 'Albany State University',              creatorName: 'Marching Ram Show Band' },
  { channelId: 'UC3QPWswazHQniPlp6hV42jA', schoolName: 'South Carolina State University',      creatorName: 'South Carolina State Marching 101' },
  { channelId: 'UC6NQkWeJCQAguQ7xVt8NADQ', schoolName: 'Prairie View A&M University',          creatorName: 'Prairie View Marching Storm' },
  { channelId: 'UCRP2Xty4XpGFt7BCUTxFHdw', schoolName: 'North Carolina A&T',                  creatorName: 'BGMM Media' },
  { channelId: 'UCE_nMi6Q0Y5gka-Eyj2Gu0Q', schoolName: 'Alabama State University',             creatorName: 'Marching Hornet Media' },
  { channelId: 'UCk0h7gTm0gYxoyLdvlyTM-Q', schoolName: 'Virginia State University',            creatorName: 'VSU Marching Band' },
  { channelId: 'UCWY_9gVTMoIgDvpXOipPChg', schoolName: 'University of Arkansas at Pine Bluff', creatorName: 'UAPB Bands' },
  { channelId: 'UC6Yj_43vYzBJSPzn3KiUvGA', schoolName: 'Delaware State University',            creatorName: 'ASMB Media' },
  { channelId: 'UCp43Tmu-IZ7lZiWTZOA-qbA', schoolName: 'Bethune-Cookman University',          creatorName: 'BCU Marching Wildcats' },
  { channelId: 'UCxFkX8EpOHdA-0xF4QYezxw', schoolName: 'Florida A&M University',               creatorName: 'The Marching 100' },
  { channelId: 'UCppWYXIzyVvdMpuo3ADWLkw', schoolName: 'Fort Valley State University',         creatorName: 'FVSU Blue Machine' },
  { channelId: 'UC0g8UINT6Sl1Y7GDACSbabQ', schoolName: 'Bowie State University',               creatorName: 'Bowie State University Bands' },
  { channelId: 'UCYHPg4Nl845658lEwmvLfXg', schoolName: 'Morgan State University',              creatorName: 'Morgan State Bands' },
  { channelId: 'UC_wzC-VZphxNrM7rspmwpzA', schoolName: 'Alcorn State University',              creatorName: 'Sounds of Dynomite Media' },
  { channelId: 'UC0lFRGztE79ViN8XDI3hpFQ', schoolName: 'Fayetteville State University',       creatorName: 'Fay State Bands' },
  { channelId: 'UCYSfU25obF63pbP23_JG5Eg', schoolName: 'Langston University',                  creatorName: 'Langston Marching Pride' },
  { channelId: 'UCH3TvR0VUfixk6kwxuxkK5g', schoolName: 'Tennessee State University',           creatorName: 'TSU Aristocrat of Bands' },
  { channelId: 'UCuPsfIzCHWgM10HsT_NOLjQ', schoolName: 'Hampton University',                   creatorName: 'Hampton University Marching Force' },
  { channelId: 'UCiiK-Yhqt_kEzbkGhCT_lsA', schoolName: 'Texas Southern University',            creatorName: 'Ocean of Soul Media' },
  { channelId: 'UCMjLDyHWed_kfj9f70hanDQ', schoolName: 'Grambling State University',           creatorName: 'GSU World Famed' },
  { channelId: 'UCQn9Gj_EF5RbXlknvHQlvmQ', schoolName: 'Talladega College',                   creatorName: 'Talladega College Marching Band' },
  { channelId: 'UCwYP8r6xGNk4cqYkFp7ACFQ', schoolName: 'Lincoln University',                  creatorName: 'Lincoln University MO Band' },
  { channelId: 'UCZqTMdGHtCb8qxHwR7wyZ0g', schoolName: 'Winston-Salem State University',      creatorName: 'WSSU Red Sea of Sound' },
  { channelId: 'UCL8bj7KbP3Y5GpvYnv3QXLA', schoolName: 'Central State University',            creatorName: 'Central State Marching Band' },
  { channelId: 'UCgQ5RDjBYdFvw8xpMwN4CkQ', schoolName: 'Kentucky State University',           creatorName: 'Kentucky State Thorobred Band' },
  { channelId: 'UCN8vGHfYJ3gRjPiTHZx8YvQ', schoolName: 'Miles College',                       creatorName: 'Miles College Purple Marching Machine' },
  { channelId: 'UCR8ynfvCPGM3WpQ8FYvBJYA', schoolName: 'Morehouse College',                   creatorName: 'Morehouse College Band' },
  { channelId: 'UCqNvMzwp8HYJWPF5vT3YVXA', schoolName: 'Clark Atlanta University',            creatorName: 'Clark Atlanta University Band' },
  { channelId: 'UCqZ5T8L3j8YJHQT1v8QPvQA', schoolName: 'Howard University',                   creatorName: 'Howard University Showtime Band' },
  { channelId: 'UCpvXkCHnNpJqBWvFjYGJxEA', schoolName: 'Savannah State University',           creatorName: 'Savannah State Marching Band' },
  { channelId: 'UCmvuyOkvYF9F6Hp4lZPnxbg', schoolName: 'Simmons College',                     creatorName: 'Simmons College Marching Band' },
  { channelId: 'UCrZZnfvdgYF6j0hpWCqLZtQ', schoolName: 'Coppin State University',             creatorName: 'Coppin State University Bands' },
  { channelId: 'UCkZPqjwG3hgFbEY5zXnqCZA', schoolName: 'Claflin University',                  creatorName: 'Claflin University Marching Band' },
  { channelId: 'UCZfXb8TLpQ6FeVy3yBJHzPA', schoolName: 'Lane College',                        creatorName: 'Lane College Marching Band' },
  { channelId: 'UCrzV8HjGkJqJT5YvHCnLF8Q', schoolName: 'Stillman College',                    creatorName: 'Stillman College Marching Band' },
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log('=== Link Creator Channels Script ===');
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'NOT FOUND — set DATABASE_URL'}`);
  console.log(`Mode: ${apply ? 'APPLY (will update Band.youtubeChannelId)' : 'DRY RUN (use --apply to save)'}\n`);

  // Load all active bands
  const bands = await prisma.band.findMany({
    where: { isActive: true },
    select: { id: true, name: true, schoolName: true, youtubeChannelId: true },
  });
  console.log(`Loaded ${bands.length} active bands\n`);

  let linked = 0;
  let alreadySet = 0;
  let notFound = 0;

  for (const entry of OFFICIAL_CHANNELS) {
    // Find band by school name — try exact match first, then partial
    let band = bands.find(
      (b) => b.schoolName.toLowerCase() === entry.schoolName.toLowerCase(),
    );

    if (!band) {
      // Partial: band.schoolName contains the entry schoolName or vice versa
      band = bands.find(
        (b) =>
          b.schoolName.toLowerCase().includes(entry.schoolName.toLowerCase()) ||
          entry.schoolName.toLowerCase().includes(b.schoolName.toLowerCase()),
      );
    }

    if (!band) {
      console.log(`  SKIP  ${entry.creatorName.padEnd(40)} — no band found for "${entry.schoolName}"`);
      notFound++;
      continue;
    }

    if (band.youtubeChannelId === entry.channelId) {
      console.log(`  OK    ${entry.creatorName.padEnd(40)} → ${band.name} (already set)`);
      alreadySet++;
      continue;
    }

    const prev = band.youtubeChannelId ? ` (was: ${band.youtubeChannelId})` : '';
    console.log(`  LINK  ${entry.creatorName.padEnd(40)} → ${band.name}${prev}`);

    if (apply) {
      await prisma.band.update({
        where: { id: band.id },
        data: { youtubeChannelId: entry.channelId },
      });
    }

    linked++;
  }

  console.log('\n=== Results ===');
  console.log(`Linked      : ${linked}${apply ? ' (saved)' : ' (dry run — not saved)'}`);
  console.log(`Already set : ${alreadySet}`);
  console.log(`Not found   : ${notFound}`);

  if (!apply && linked > 0) {
    console.log('\nRun with --apply to save these links.');
    console.log('Then re-run match-videos.ts — Stage 0 channel ownership will match their videos.');
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
