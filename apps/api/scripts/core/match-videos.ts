/**
 * Match Videos Script
 *
 * Direct port of MatchVideosProcessor — runs the full 3-stage matching cascade
 * against the database without needing the BullMQ queue or worker process.
 *
 * Stages:
 *   0. Channel Ownership  — immediate 100-confidence match, never overridden
 *   1. AI Extraction      — uses pre-stored aiExtraction data (no new AI calls)
 *   2. Alias Matching     — keyword scoring across title / description / channel
 *
 * Writes noMatchReason + matchAttemptedAt on every path.
 *
 * Usage:
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts --limit=5000
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts --all
 *
 * Flags:
 *   --all      Re-match ALL videos (including already-matched ones) — fixes bad assignments
 *   --limit=N  Process at most N videos
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env — works from both tsx (scripts/core/) and compiled bundle (scripts/dist/)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../apps/api/.env') });
dotenv.config();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BandRecord {
  id: string;
  name: string;
  schoolName: string;
  bandType: string;
  youtubeChannelId: string | null;
  searchKeywords: string[];
}

interface AliasedBand extends BandRecord {
  aliases: string[];
  kwAliases: Set<string>; // explicit searchKeywords — get boosted base score
}

interface MatchResult {
  bandId: string;
  bandName: string;
  bandType: string;
  score: number;
  matchedAlias: string;
}

interface LibrarianExtraction {
  isHbcuBandContent: boolean;
  primaryBandId?: string;
  opponentBandId?: string;
  participantBandIds?: string[];
  isBattle?: boolean;
  confidence: number;
  exclusionReason?: string;
  videoCategory?: string;
}

// ---------------------------------------------------------------------------
// Constants — mirrors match-videos.processor.ts exactly
// ---------------------------------------------------------------------------

const MIN_CONFIDENCE = 50;

const PEP_SIGNALS = [
  'pep band', 'basketball', 'gym', 'indoor arena', 'bleacher', 'sideline',
  'basketball game', 'indoor performance',
];
const MARCH_SIGNALS = [
  'halftime', 'parade', 'field show', 'homecoming', 'battle of the bands',
  'botb', 'fifth quarter', 'pregame', 'stand battle', 'half time',
];

// ---------------------------------------------------------------------------
// Alias index
// ---------------------------------------------------------------------------

function buildAliasIndex(bands: BandRecord[]): AliasedBand[] {
  return bands.map((band) => {
    const aliases = new Set<string>();
    const kwAliases = new Set<string>();

    aliases.add(band.name.toLowerCase());
    aliases.add(band.schoolName.toLowerCase());

    // Track explicit searchKeywords separately — they score higher and allow 2-char
    for (const kw of band.searchKeywords) {
      const kwLower = kw.toLowerCase();
      kwAliases.add(kwLower);
      aliases.add(kwLower);
    }

    const schoolSimplified = band.schoolName
      .replace(/\s+university$/i, '')
      .replace(/\s+college$/i, '')
      .trim()
      .toLowerCase();
    if (schoolSimplified !== band.schoolName.toLowerCase() && schoolSimplified.length >= 4) {
      aliases.add(schoolSimplified);
    }

    const acronym = band.schoolName
      .replace(/&/g, 'and')
      .split(/\s+/)
      .filter((w) => !['of', 'the', 'at', 'and'].includes(w.toLowerCase()))
      .map((w) => w[0])
      .join('')
      .toLowerCase();
    if (acronym.length >= 2 && acronym.length <= 5) {
      aliases.add(acronym);
    }

    // searchKeyword aliases: allow 2-char; auto-generated aliases: require 3-char minimum
    return { ...band, aliases: Array.from(aliases).filter((a) => kwAliases.has(a) ? a.length >= 2 : a.length >= 3), kwAliases };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function baseAliasScore(alias: string, band: AliasedBand): number {
  if (alias === band.name.toLowerCase()) return 100;
  if (band.bandType !== 'ALL_STAR' && alias === band.schoolName.toLowerCase()) return 80;
  // Explicit searchKeywords get a boosted minimum so 2-5 char abbreviations reach MIN_CONFIDENCE
  // (e.g. "JSU", "FAMU", "SU" each score 50 → 60+ with title/channel bonus)
  if (band.kwAliases.has(alias)) return alias.length >= 8 ? 70 : alias.length >= 5 ? 55 : 50;
  if (alias.length >= 8) return 60;
  if (alias.length >= 5) return 45;
  if (alias.length >= 3) return 20;
  return 15;
}

function countOccurrences(alias: string, text: string, wordBoundary: boolean): number {
  if (wordBoundary) {
    const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(alias, pos)) !== -1) {
    count++;
    pos += alias.length;
  }
  return count;
}

function findTitleParticipants(
  titleText: string,
  bandsWithAliases: AliasedBand[],
  excludeBandId: string,
): MatchResult[] {
  const lowerTitle = titleText.toLowerCase();
  const matches: MatchResult[] = [];

  for (const band of bandsWithAliases) {
    if (band.id === excludeBandId) continue;
    for (const alias of band.aliases) {
      if (alias.length < 4) continue;
      let found = false;
      if (alias.length <= 5) {
        const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        found = regex.test(lowerTitle);
      } else {
        found = lowerTitle.includes(alias);
      }
      if (found) {
        matches.push({ bandId: band.id, bandName: band.name, bandType: band.bandType, score: 60, matchedAlias: alias });
        break;
      }
    }
  }

  return matches;
}

function findAliasMatches(
  titleText: string,
  descText: string,
  channelText: string,
  bandsWithAliases: AliasedBand[],
): MatchResult[] {
  const lowerTitle = titleText.toLowerCase();
  const lowerDesc = descText.toLowerCase();
  const lowerChannel = channelText.toLowerCase();
  const combined = lowerTitle + ' ' + lowerDesc;

  const matches: MatchResult[] = [];

  for (const band of bandsWithAliases) {
    let bestScore = 0;
    let bestAlias = '';

    for (const alias of band.aliases) {
      if (alias.length < 3) continue;

      const useWordBoundary = alias.length <= 4;
      const regex = useWordBoundary ? new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i') : null;

      // Always use word-boundary for all fields — prevents brand-name pollution
      // (e.g. "showtime" must not match "ShowtimeWeb.com" in descriptions)
      const wbRegex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
      const inChannel = wbRegex.test(lowerChannel);
      const inTitle   = wbRegex.test(lowerTitle);
      const inDesc    = wbRegex.test(lowerDesc);

      if (!inChannel && !inTitle && !inDesc) continue;

      let score = baseAliasScore(alias, band);

      if (inChannel) {
        score = Math.min(Math.round(score * 1.75), 100);
      }

      if (inTitle || inDesc) {
        const occurrences = countOccurrences(alias, combined, useWordBoundary);
        score += Math.min((occurrences - 1) * 5, 15);
      }

      if (inTitle) score += 10;
      else if (inDesc && lowerDesc.substring(0, 200).includes(alias)) score += 5;

      score = Math.min(score, 100);

      if (score > bestScore) {
        bestScore = score;
        bestAlias = alias;
      }
    }

    if (bestScore >= MIN_CONFIDENCE) {
      matches.push({
        bandId: band.id,
        bandName: band.name,
        bandType: band.bandType,
        score: bestScore,
        matchedAlias: bestAlias,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function disambiguateSameSchool(
  qualifiedMatches: MatchResult[],
  bandById: Map<string, AliasedBand>,
  combinedText: string,
): MatchResult {
  if (qualifiedMatches.length < 2) return qualifiedMatches[0];

  const text = combinedText.toLowerCase();
  const bySchool = new Map<string, MatchResult[]>();

  for (const m of qualifiedMatches) {
    const band = bandById.get(m.bandId);
    if (!band) continue;
    const schoolKey = band.schoolName.toLowerCase();
    if (!bySchool.has(schoolKey)) bySchool.set(schoolKey, []);
    bySchool.get(schoolKey)!.push(m);
  }

  for (const [, schoolMatches] of bySchool) {
    if (schoolMatches.length < 2) continue;

    const pepScore  = PEP_SIGNALS.filter((s) => text.includes(s)).length;
    const marchScore = MARCH_SIGNALS.filter((s) => text.includes(s)).length;

    if (marchScore > pepScore) {
      const marchingMatch = schoolMatches.find(
        (m) => !bandById.get(m.bandId)?.searchKeywords.includes('pep band'),
      );
      if (marchingMatch) {
        const idx = qualifiedMatches.findIndex((m) => m.bandId === marchingMatch.bandId);
        if (idx > 0) { qualifiedMatches.splice(idx, 1); qualifiedMatches.unshift(marchingMatch); }
      }
    } else if (pepScore > marchScore) {
      const pepMatch = schoolMatches.find((m) =>
        bandById.get(m.bandId)?.searchKeywords.includes('pep band'),
      );
      if (pepMatch) {
        const idx = qualifiedMatches.findIndex((m) => m.bandId === pepMatch.bandId);
        if (idx > 0) { qualifiedMatches.splice(idx, 1); qualifiedMatches.unshift(pepMatch); }
      }
    }
  }

  return qualifiedMatches[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const matchAll = args.includes('--all');

  console.log('=== Match Videos Script ===');
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'NOT FOUND — set DATABASE_URL'}`);
  console.log(`Mode: ${matchAll ? 'ALL videos (re-match everything)' : 'unmatched only (bandId = null)'}`);
  if (limit) console.log(`Limit: ${limit}`);

  // Load all active bands
  console.log('\nLoading bands...');
  const bands: BandRecord[] = await prisma.band.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      schoolName: true,
      bandType: true,
      youtubeChannelId: true,
      searchKeywords: true,
    },
  });
  console.log(`Loaded ${bands.length} bands`);

  const bandsWithAliases = buildAliasIndex(bands);
  const bandById = new Map<string, AliasedBand>(bandsWithAliases.map((b) => [b.id, b]));

  const channelOwnershipMap = new Map<string, string>();
  for (const band of bands) {
    if (band.youtubeChannelId) channelOwnershipMap.set(band.youtubeChannelId, band.id);
  }
  console.log(`Channel ownership map: ${channelOwnershipMap.size} bands with known channels`);

  // Fetch videos to process
  const modeLabel = matchAll ? 'all non-excluded videos' : 'unmatched videos';
  console.log(`\nFetching ${modeLabel}...`);
  const videos = await prisma.youTubeVideo.findMany({
    where: matchAll ? { aiExcluded: false } : { bandId: null, aiExcluded: false },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      description: true,
      channelId: true,
      channelTitle: true,
      aiProcessed: true,
      aiExtraction: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Found ${videos.length} videos to process\n`);

  if (videos.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Counters
  let totalProcessed = 0;
  let channelOwnership = 0;
  let aiMatched = 0;
  let aliasMatched = 0;
  let excluded = 0;
  let noMatch = 0;
  let lowConfidence = 0;
  let battleVideos = 0;
  let errors = 0;

  const startTime = Date.now();

  for (const video of videos) {
    totalProcessed++;
    const titleText   = video.title || '';
    const descText    = video.description || '';
    const channelText = video.channelTitle || '';

    try {
      // ------------------------------------------------------------------
      // Stage 0: Channel Ownership
      // ------------------------------------------------------------------
      const ownerBandId = channelOwnershipMap.get(video.channelId);
      if (ownerBandId) {
        const ownerBand = bandById.get(ownerBandId);
        if (ownerBand) {
          const titleParticipants = findTitleParticipants(titleText, bandsWithAliases, ownerBandId);
          const participantBandIds = [ownerBandId, ...titleParticipants.map((m) => m.bandId)];
          const opponentBandId = titleParticipants.length > 0 ? titleParticipants[0].bandId : null;

          await (prisma.youTubeVideo.update as any)({
            where: { id: video.id },
            data: {
              bandId: ownerBandId,
              opponentBandId,
              participantBandIds,
              qualityScore: 100,
              matchConfidence: 100,
              matchSource: 'CHANNEL_OWNERSHIP',
              noMatchReason: null,
              matchAttemptedAt: new Date(),
            },
          });
          channelOwnership++;
          if (titleParticipants.length > 0) battleVideos++;
          continue;
        }
      }

      // ------------------------------------------------------------------
      // Stage 1: AI Extraction (uses pre-stored data — no API calls)
      // ------------------------------------------------------------------
      const aiData = video.aiExtraction as LibrarianExtraction | null;

      if (video.aiProcessed && aiData) {
        if (!aiData.isHbcuBandContent && aiData.exclusionReason) {
          await (prisma.youTubeVideo.update as any)({
            where: { id: video.id },
            data: { aiExcluded: true, noMatchReason: 'ai_excluded', matchAttemptedAt: new Date() },
          });
          excluded++;
          continue;
        }

        if (aiData.primaryBandId && aiData.confidence >= MIN_CONFIDENCE) {
          const primaryBand = bandById.get(aiData.primaryBandId);
          if (primaryBand) {
            let opponentBandId: string | null = null;
            let participantBandIds: string[] = [primaryBand.id];

            if (aiData.participantBandIds && aiData.participantBandIds.length > 0) {
              const verified = aiData.participantBandIds.filter((id: string) => bandById.has(id));
              if (verified.length > 0) {
                participantBandIds = verified;
                if (!participantBandIds.includes(primaryBand.id)) participantBandIds.unshift(primaryBand.id);
                opponentBandId = participantBandIds.find((id: string) => id !== primaryBand.id) ?? null;
              }
            } else if (aiData.isBattle && aiData.opponentBandId) {
              const opponentBand = bandById.get(aiData.opponentBandId);
              if (opponentBand) {
                opponentBandId = opponentBand.id;
                participantBandIds = [primaryBand.id, opponentBand.id];
              }
            }

            await (prisma.youTubeVideo.update as any)({
              where: { id: video.id },
              data: {
                bandId: primaryBand.id,
                opponentBandId,
                participantBandIds,
                qualityScore: aiData.confidence,
                matchConfidence: aiData.confidence,
                matchSource: 'AI',
                noMatchReason: null,
                matchAttemptedAt: new Date(),
              },
            });
            aiMatched++;
            if (participantBandIds.length > 2) battleVideos++;
            else if (opponentBandId) battleVideos++;
            continue;
          }
          // primaryBandId not in DB — fall through to alias
        }
      }

      // ------------------------------------------------------------------
      // Stage 2: Alias Matching
      // ------------------------------------------------------------------
      const allMatches = findAliasMatches(titleText, descText, channelText, bandsWithAliases);

      if (allMatches.length === 0) {
        await (prisma.youTubeVideo.update as any)({
          where: { id: video.id },
          data: {
            bandId: null,
            opponentBandId: null,
            participantBandIds: [],
            matchConfidence: 0,
            matchSource: null,
            noMatchReason: 'no_alias_found',
            matchAttemptedAt: new Date(),
          },
        });
        noMatch++;
        continue;
      }

      const topMatch = allMatches[0];
      if (topMatch.score < MIN_CONFIDENCE) {
        await (prisma.youTubeVideo.update as any)({
          where: { id: video.id },
          data: {
            bandId: null,
            opponentBandId: null,
            participantBandIds: [],
            matchConfidence: 0,
            matchSource: null,
            noMatchReason: 'low_confidence',
            matchAttemptedAt: new Date(),
          },
        });
        lowConfidence++;
        continue;
      }

      const qualifiedMatches = allMatches.filter((m) => m.score >= MIN_CONFIDENCE);
      const resolvedPrimary = disambiguateSameSchool(
        qualifiedMatches,
        bandById,
        titleText + ' ' + descText,
      );

      const opponentBandId =
        qualifiedMatches.length >= 2 &&
        qualifiedMatches[1].bandId !== resolvedPrimary.bandId &&
        qualifiedMatches[1].score >= MIN_CONFIDENCE
          ? qualifiedMatches[1].bandId
          : null;

      const participantBandIds = qualifiedMatches.map((m) => m.bandId);

      await (prisma.youTubeVideo.update as any)({
        where: { id: video.id },
        data: {
          bandId: resolvedPrimary.bandId,
          opponentBandId,
          participantBandIds,
          qualityScore: resolvedPrimary.score,
          matchConfidence: resolvedPrimary.score,
          matchSource: 'ALIAS',
          noMatchReason: null,
          matchAttemptedAt: new Date(),
        },
      });
      aliasMatched++;
      if (participantBandIds.length > 2) battleVideos++;
      else if (opponentBandId) battleVideos++;

    } catch (err) {
      errors++;
      console.error(`  Error on ${video.youtubeId}: ${err instanceof Error ? err.message : err}`);
    }

    if (totalProcessed % 500 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const matched = channelOwnership + aiMatched + aliasMatched;
      console.log(
        `  [${elapsed}s] ${totalProcessed}/${videos.length} — matched: ${matched}, no_match: ${noMatch}, low_conf: ${lowConfidence}, excluded: ${excluded}`,
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalMatched = channelOwnership + aiMatched + aliasMatched;
  const matchRate = ((totalMatched / totalProcessed) * 100).toFixed(1);

  console.log('\n=== Results ===');
  console.log(`Total processed  : ${totalProcessed}`);
  console.log(`Total matched    : ${totalMatched} (${matchRate}%)`);
  console.log(`  Channel owner  : ${channelOwnership}`);
  console.log(`  AI extraction  : ${aiMatched}`);
  console.log(`  Alias match    : ${aliasMatched}`);
  console.log(`  Battles        : ${battleVideos}`);
  console.log(`No match         : ${noMatch}`);
  console.log(`Low confidence   : ${lowConfidence}`);
  console.log(`AI excluded      : ${excluded}`);
  console.log(`Errors           : ${errors}`);
  console.log(`Duration         : ${elapsed}s`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
