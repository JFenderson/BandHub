import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QueueName,
  JobType,
  MatchVideosJobData,
  LibrarianExtraction,
} from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { BandLibrarianService } from '../services/band-librarian.service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
}

interface MatchResult {
  bandId: string;
  bandName: string;
  bandType: string;
  score: number;
  matchedAlias: string;
}

interface MatchingResult {
  totalProcessed: number;
  matchedHBCU: number;
  matchedAllStar: number;
  excluded: number;
  singleBand: number;
  battleVideos: number;
  multiParticipant: number;
  noMatch: number;
  lowConfidence: number;
  channelOwnership: number;
  errors: string[];
  duration: number;
}

// Minimum confidence threshold — raised from 30 to 50 to reduce false matches
const MIN_CONFIDENCE = 50;

// Keywords for pep vs. marching band disambiguation
const PEP_SIGNALS = [
  'pep band', 'basketball', 'gym', 'indoor arena', 'bleacher', 'sideline',
  'basketball game', 'indoor performance',
];
const MARCH_SIGNALS = [
  'halftime', 'parade', 'field show', 'homecoming', 'battle of the bands',
  'botb', 'fifth quarter', 'pregame', 'stand battle', 'half time',
];

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 2,
})
export class MatchVideosProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchVideosProcessor.name);

  constructor(
    private databaseService: DatabaseService,
    private bandLibrarian: BandLibrarianService,
  ) {
    super();
  }

  async process(job: Job<MatchVideosJobData>): Promise<MatchingResult> {
    const { triggeredBy, limit } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting video matching (triggered by: ${triggeredBy})`);

    const result: MatchingResult = {
      totalProcessed: 0,
      matchedHBCU: 0,
      matchedAllStar: 0,
      excluded: 0,
      singleBand: 0,
      battleVideos: 0,
      multiParticipant: 0,
      noMatch: 0,
      lowConfidence: 0,
      channelOwnership: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Load all active bands from DB
      this.logger.log('Fetching bands from database...');
      const bands: BandRecord[] = await this.databaseService.band.findMany({
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
      this.logger.log(`Found ${bands.length} bands in database`);

      // Refresh AI context if band list has changed
      await this.bandLibrarian.refreshBandContext();

      // Build channel ownership map: youtubeChannelId → bandId
      const channelOwnershipMap = new Map<string, string>();
      for (const band of bands) {
        if (band.youtubeChannelId) {
          channelOwnershipMap.set(band.youtubeChannelId, band.id);
        }
      }
      this.logger.log(`Channel ownership map: ${channelOwnershipMap.size} bands with known channels`);

      // Build alias index for all bands
      const bandsWithAliases = this.buildAliasIndex(bands);

      // Build a quick lookup map: bandId → band
      const bandById = new Map<string, AliasedBand>();
      for (const b of bandsWithAliases) {
        bandById.set(b.id, b);
      }

      // Fetch unmatched, non-excluded videos
      this.logger.log('Fetching unmatched videos...');
      const videos = await this.databaseService.youTubeVideo.findMany({
        where: { bandId: null, aiExcluded: false },
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

      this.logger.log(`Found ${videos.length} unmatched videos`);

      if (videos.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      await job.updateProgress({
        stage: 'matching',
        current: 0,
        total: videos.length,
        message: `Matching ${videos.length} videos`,
      });

      for (const [index, video] of videos.entries()) {
        result.totalProcessed++;

        try {
          await this.processVideo(video, bands, bandsWithAliases, bandById, channelOwnershipMap, result);
        } catch (error) {
          result.errors.push(`Error processing ${video.youtubeId}: ${getErrorMessage(error)}`);
        }

        if ((index + 1) % 100 === 0) {
          await job.updateProgress({
            stage: 'matching',
            current: index + 1,
            total: videos.length,
            message: `Processed ${index + 1}/${videos.length} videos`,
          });
        }
      }
    } catch (error) {
      this.logger.error('Video matching failed', error);
      result.errors.push(getErrorMessage(error));
      throw error;
    }

    result.duration = Date.now() - startTime;

    const totalMatched = result.matchedHBCU + result.matchedAllStar + result.channelOwnership;
    const matchRate =
      result.totalProcessed > 0
        ? ((totalMatched / result.totalProcessed) * 100).toFixed(1)
        : '0';

    this.logger.log(
      `Completed video matching: ${result.totalProcessed} processed, ` +
        `${totalMatched} matched (${matchRate}%), ` +
        `${result.channelOwnership} via channel ownership, ` +
        `${result.excluded} excluded, ${result.noMatch} no match, ` +
        `${result.lowConfidence} low confidence`,
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Core per-video matching logic — three-stage cascade
  // ---------------------------------------------------------------------------

  private async processVideo(
    video: {
      id: string;
      youtubeId: string;
      title: string;
      description: string | null;
      channelId: string;
      channelTitle: string | null;
      aiProcessed: boolean;
      aiExtraction: unknown;
    },
    bands: BandRecord[],
    bandsWithAliases: AliasedBand[],
    bandById: Map<string, AliasedBand>,
    channelOwnershipMap: Map<string, string>,
    result: MatchingResult,
  ): Promise<void> {
    const titleText = video.title || '';
    const descText = video.description || '';
    const channelText = video.channelTitle || '';

    // -------------------------------------------------------------------------
    // Stage 0: Channel Ownership Pre-filter
    // -------------------------------------------------------------------------
    const ownerBandId = channelOwnershipMap.get(video.channelId);
    if (ownerBandId) {
      const ownerBand = bandById.get(ownerBandId);
      if (ownerBand) {
        // High-confidence match via channel ownership.
        // Still scan title for additional participant bands (e.g. battle on own channel).
        const titleParticipants = this.findTitleParticipants(
          titleText,
          bandsWithAliases,
          ownerBandId,
        );
        const participantBandIds = [ownerBandId, ...titleParticipants.map((m) => m.bandId)];
        const opponentBandId =
          titleParticipants.length > 0 ? titleParticipants[0].bandId : null;

        await (this.databaseService.youTubeVideo.update as any)({
          where: { id: video.id },
          data: {
            bandId: ownerBandId,
            opponentBandId,
            participantBandIds,
            qualityScore: 100,
            matchConfidence: 100,
            matchSource: 'CHANNEL_OWNERSHIP',
          },
        });

        result.channelOwnership++;
        if (titleParticipants.length > 0) {
          result.battleVideos++;
        }
        return;
      }
    }

    // -------------------------------------------------------------------------
    // Stage 1: AI Primary Path
    // -------------------------------------------------------------------------
    const aiData = video.aiExtraction as LibrarianExtraction | null;

    if (video.aiProcessed && aiData) {
      // Exclusion check
      if (!aiData.isHbcuBandContent && aiData.exclusionReason) {
        await this.databaseService.youTubeVideo.update({
          where: { id: video.id },
          data: { aiExcluded: true },
        });
        result.excluded++;
        return;
      }

      // Use AI match if we have a band ID and sufficient confidence
      if (aiData.primaryBandId && aiData.confidence >= MIN_CONFIDENCE) {
        const primaryBand = bandById.get(aiData.primaryBandId);
        if (primaryBand) {
          const resolvedMatch = this.resolveAiMatch(aiData, bandById, primaryBand);

          await (this.databaseService.youTubeVideo.update as any)({
            where: { id: video.id },
            data: {
              bandId: resolvedMatch.primaryBandId,
              opponentBandId: resolvedMatch.opponentBandId,
              participantBandIds: resolvedMatch.participantBandIds,
              qualityScore: aiData.confidence,
              matchConfidence: aiData.confidence,
              matchSource: 'AI',
            },
          });

          this.updateBandTypeStats(primaryBand, result);
          if (resolvedMatch.participantBandIds.length > 2) {
            result.multiParticipant++;
          } else if (resolvedMatch.opponentBandId) {
            result.battleVideos++;
          } else {
            result.singleBand++;
          }
          return;
        }
        // primaryBandId present but not found in DB — fall through to alias
        this.logger.warn(
          `AI returned unknown bandId "${aiData.primaryBandId}" for ${video.youtubeId} — falling back to alias`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Stage 2: Enhanced Alias Fallback
    // -------------------------------------------------------------------------
    const allMatches = this.findAliasMatches(
      titleText,
      descText,
      channelText,
      bandsWithAliases,
    );

    if (allMatches.length === 0) {
      result.noMatch++;
      return;
    }

    const topMatch = allMatches[0];
    if (topMatch.score < MIN_CONFIDENCE) {
      result.lowConfidence++;
      return;
    }

    // Apply same-school disambiguation if multiple bands from same school scored above threshold
    const qualifiedMatches = allMatches.filter((m) => m.score >= MIN_CONFIDENCE);
    const resolvedPrimary = this.disambiguateSameSchool(qualifiedMatches, bandById, titleText + ' ' + descText);

    const opponentBandId =
      qualifiedMatches.length >= 2 &&
      qualifiedMatches[1].bandId !== resolvedPrimary.bandId &&
      qualifiedMatches[1].score >= MIN_CONFIDENCE
        ? qualifiedMatches[1].bandId
        : null;

    const participantBandIds = qualifiedMatches.map((m) => m.bandId);

    await (this.databaseService.youTubeVideo.update as any)({
      where: { id: video.id },
      data: {
        bandId: resolvedPrimary.bandId,
        opponentBandId,
        participantBandIds,
        qualityScore: resolvedPrimary.score,
        matchConfidence: resolvedPrimary.score,
        matchSource: 'ALIAS',
      },
    });

    const primaryBand = bandById.get(resolvedPrimary.bandId)!;
    this.updateBandTypeStats(primaryBand, result);
    if (participantBandIds.length > 2) {
      result.multiParticipant++;
    } else if (opponentBandId) {
      result.battleVideos++;
    } else {
      result.singleBand++;
    }
  }

  // ---------------------------------------------------------------------------
  // AI match resolution
  // ---------------------------------------------------------------------------

  private resolveAiMatch(
    aiData: LibrarianExtraction,
    bandById: Map<string, AliasedBand>,
    primaryBand: AliasedBand,
  ): { primaryBandId: string; opponentBandId: string | null; participantBandIds: string[] } {
    let opponentBandId: string | null = null;
    let participantBandIds: string[] = [primaryBand.id];

    if (aiData.participantBandIds && aiData.participantBandIds.length > 0) {
      // 3+ band battle — verify each ID exists in DB
      const verifiedParticipants = aiData.participantBandIds.filter((id) => bandById.has(id));
      if (verifiedParticipants.length > 0) {
        participantBandIds = verifiedParticipants;
        // Ensure primary is in the list
        if (!participantBandIds.includes(primaryBand.id)) {
          participantBandIds.unshift(primaryBand.id);
        }
        // Set opponent as second band (different from primary)
        const secondBand = participantBandIds.find((id) => id !== primaryBand.id);
        opponentBandId = secondBand ?? null;
      }
    } else if (aiData.isBattle && aiData.opponentBandId) {
      const opponentBand = bandById.get(aiData.opponentBandId);
      if (opponentBand) {
        opponentBandId = opponentBand.id;
        participantBandIds = [primaryBand.id, opponentBand.id];
      }
    }

    return { primaryBandId: primaryBand.id, opponentBandId, participantBandIds };
  }

  // ---------------------------------------------------------------------------
  // Channel-ownership: find additional participant bands from title
  // ---------------------------------------------------------------------------

  private findTitleParticipants(
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
          const regex = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i');
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

  // ---------------------------------------------------------------------------
  // Enhanced alias matching
  // ---------------------------------------------------------------------------

  private findAliasMatches(
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
        const regex = useWordBoundary
          ? new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i')
          : null;

        const inChannel = useWordBoundary ? regex!.test(lowerChannel) : lowerChannel.includes(alias);
        const inTitle = useWordBoundary ? regex!.test(lowerTitle) : lowerTitle.includes(alias);
        const inDesc = useWordBoundary ? regex!.test(lowerDesc) : lowerDesc.includes(alias);

        if (!inChannel && !inTitle && !inDesc) continue;

        // Base score
        let score = this.baseAliasScore(alias, band);

        // Channel title match multiplier (1.75×) — strong signal when not an alias collision
        if (inChannel) {
          score = Math.min(Math.round(score * 1.75), 100);
        }

        // Frequency bonus: count occurrences in title + description (not channel)
        if (inTitle || inDesc) {
          const occurrences = this.countOccurrences(alias, combined, useWordBoundary);
          score += Math.min((occurrences - 1) * 5, 15);
        }

        // Position bonus
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

  private baseAliasScore(alias: string, band: AliasedBand): number {
    // Exact full band name
    if (alias === band.name.toLowerCase()) return 100;
    // Full school name (HBCU only)
    if (band.bandType !== 'ALL_STAR' && alias === band.schoolName.toLowerCase()) return 80;
    // Length-based fallback
    if (alias.length >= 8) return 60;
    if (alias.length >= 5) return 45;
    if (alias.length >= 3) return 20;
    return 15;
  }

  private countOccurrences(alias: string, text: string, wordBoundary: boolean): number {
    if (wordBoundary) {
      const regex = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'gi');
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

  // ---------------------------------------------------------------------------
  // Same-school disambiguation (pep band vs. marching band)
  // ---------------------------------------------------------------------------

  private disambiguateSameSchool(
    qualifiedMatches: MatchResult[],
    bandById: Map<string, AliasedBand>,
    combinedText: string,
  ): MatchResult {
    if (qualifiedMatches.length < 2) return qualifiedMatches[0];

    const text = combinedText.toLowerCase();

    // Group by school
    const bySchool = new Map<string, MatchResult[]>();
    for (const m of qualifiedMatches) {
      const band = bandById.get(m.bandId);
      if (!band) continue;
      const schoolKey = band.schoolName.toLowerCase();
      if (!bySchool.has(schoolKey)) bySchool.set(schoolKey, []);
      bySchool.get(schoolKey)!.push(m);
    }

    // Find schools with ambiguity
    for (const [, schoolMatches] of bySchool) {
      if (schoolMatches.length < 2) continue;

      const pepScore = PEP_SIGNALS.filter((s) => text.includes(s)).length;
      const marchScore = MARCH_SIGNALS.filter((s) => text.includes(s)).length;

      if (marchScore > pepScore) {
        // Prefer non-pep band
        const marchingMatch = schoolMatches.find(
          (m) => !bandById.get(m.bandId)?.searchKeywords.includes('pep band'),
        );
        if (marchingMatch) {
          // Replace the ambiguous matches with the disambiguated winner
          const idx = qualifiedMatches.findIndex((m) => m.bandId === marchingMatch.bandId);
          if (idx > 0) {
            qualifiedMatches.splice(idx, 1);
            qualifiedMatches.unshift(marchingMatch);
          }
        }
      } else if (pepScore > marchScore) {
        // Prefer pep band
        const pepMatch = schoolMatches.find((m) =>
          bandById.get(m.bandId)?.searchKeywords.includes('pep band'),
        );
        if (pepMatch) {
          const idx = qualifiedMatches.findIndex((m) => m.bandId === pepMatch.bandId);
          if (idx > 0) {
            qualifiedMatches.splice(idx, 1);
            qualifiedMatches.unshift(pepMatch);
          }
        }
      }
    }

    return qualifiedMatches[0];
  }

  // ---------------------------------------------------------------------------
  // Alias index builder — uses DB searchKeywords, no file loading
  // ---------------------------------------------------------------------------

  private buildAliasIndex(bands: BandRecord[]): AliasedBand[] {
    return bands.map((band) => {
      const aliases = new Set<string>();

      // Full band name and school name
      aliases.add(band.name.toLowerCase());
      aliases.add(band.schoolName.toLowerCase());

      // All searchKeywords from the DB
      for (const kw of band.searchKeywords) {
        if (kw.length >= 3) aliases.add(kw.toLowerCase());
      }

      // School name without "University" / "College" suffix
      const schoolSimplified = band.schoolName
        .replace(/\s+university$/i, '')
        .replace(/\s+college$/i, '')
        .trim()
        .toLowerCase();
      if (schoolSimplified !== band.schoolName.toLowerCase() && schoolSimplified.length >= 4) {
        aliases.add(schoolSimplified);
      }

      // Generated acronym from school name words
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

      return { ...band, aliases: Array.from(aliases).filter((a) => a.length >= 3) };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private updateBandTypeStats(band: AliasedBand, result: MatchingResult): void {
    if (band.bandType === 'ALL_STAR') {
      result.matchedAllStar++;
    } else {
      result.matchedHBCU++;
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed`, error.stack);
  }
}
