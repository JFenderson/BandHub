import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { 
  QueueName, 
  JobType, 
  MatchVideosJobData,
} from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// Import HBCU bands configuration from API
// We need to copy this or access it via a shared location
interface BandChannelConfig {
  name: string;
  school: string;
  city: string;
  state: string;
  channelId?: string;
  channelHandle?: string;
  playlistIds?: string[];
  keywords: string[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface MatchResult {
  bandId: string;
  bandName: string;
  bandType: string;
  score: number;
  matchedAlias: string;
  matchType: 'exact_band_name' | 'school_name' | 'partial' | 'abbreviation' | 'all_star' | 'event';
}

interface BandWithAliases {
  id: string;
  name: string;
  schoolName: string;
  state: string;
  bandType: string;
  aliases: string[];
}

interface MatchingResult {
  totalProcessed: number;
  matchedHBCU: number;
  matchedAllStar: number;
  excluded: number;
  singleBand: number;
  battleVideos: number;
  noMatch: number;
  lowConfidence: number;
  errors: string[];
  duration: number;
}

// Battle detection keywords
const BATTLE_KEYWORDS = [
  ' vs ', ' vs. ', ' v. ', ' v ', ' versus ',
  'battle', 'botb', 'band battle', 'battle of the bands',
  'showdown', 'face off', 'faceoff',
];

// Event-based matching configuration
const EVENT_PARTICIPANTS: { [key: string]: string[] } = {
  'meac swac challenge': ['Alcorn State', 'Jackson State', 'Southern', 'Grambling State', 'Alabama State', 'Alabama A&M', 'Norfolk State', 'North Carolina A&T', 'South Carolina State'],
  'bayou classic': ['Southern University', 'Grambling State'],
  'magic city classic': ['Alabama State', 'Alabama A&M'],
  'florida classic': ['Florida A&M', 'Bethune-Cookman'],
  'circle city classic': ['various'],
};

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 2,
})
export class MatchVideosProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchVideosProcessor.name);
  private allStarConfig: any;
  private hbcuBands: BandChannelConfig[] = [];
  
  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
  ) {
    super();
    this.loadConfigurations();
  }
  
  private loadConfigurations() {
    try {
      // Load all-star configuration
      const allStarConfigPath = path.resolve(process.cwd(), 'allstar-config.json');
      this.allStarConfig = JSON.parse(fs.readFileSync(allStarConfigPath, 'utf-8'));
      
      // Load HBCU bands - try to require from API
      try {
        const hbcuBandsModule = require('../../../../apps/api/src/config/hbcu-bands');
        this.hbcuBands = hbcuBandsModule.HBCU_BANDS || [];
      } catch (error) {
        this.logger.warn('Could not load HBCU_BANDS from API config, will rely on database only');
        this.hbcuBands = [];
      }
      
      this.logger.log(`Loaded ${this.hbcuBands.length} HBCU band configs`);
    } catch (error) {
      this.logger.error('Error loading configurations', error);
    }
  }
  
  async process(job: Job<MatchVideosJobData>): Promise<MatchingResult> {
    const { triggeredBy, limit, minConfidence = 30 } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`Starting video matching (triggered by: ${triggeredBy}, min confidence: ${minConfidence})`);
    
    const result: MatchingResult = {
      totalProcessed: 0,
      matchedHBCU: 0,
      matchedAllStar: 0,
      excluded: 0,
      singleBand: 0,
      battleVideos: 0,
      noMatch: 0,
      lowConfidence: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Fetch all bands from database
      this.logger.log('Fetching bands from database...');
      const bands = await this.databaseService.prisma.band.findMany({
        select: {
          id: true,
          name: true,
          schoolName: true,
          state: true,
          bandType: true,
        },
      });
      
      this.logger.log(`Found ${bands.length} bands in database`);
      
      // Generate aliases for all bands
      const bandsWithAliases = this.generateAliasesForBands(bands);
      
      // Fetch unmatched videos
      this.logger.log('Fetching unmatched videos...');
      const videos = await this.databaseService.prisma.youTubeVideo.findMany({
        where: { bandId: null },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          description: true,
          channelTitle: true,
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
      
      // Process each video
      for (const [index, video] of videos.entries()) {
        result.totalProcessed++;
        
        const searchText = [
          video.title || '',
          video.description || '',
          video.channelTitle || '',
        ].join(' ');
        
        // Check exclusions first
        const exclusionCheck = this.shouldExclude(searchText);
        if (exclusionCheck.exclude) {
          result.excluded++;
          continue;
        }
        
        // Check for event-based matching
        const eventMatches = this.findEventMatches(searchText, bandsWithAliases);
        let matches: MatchResult[];
        
        if (eventMatches.length > 0) {
          matches = eventMatches;
        } else {
          // Regular matching
          matches = this.findMatches(searchText, bandsWithAliases);
        }
        
        if (matches.length === 0) {
          result.noMatch++;
          continue;
        }
        
        const topMatch = matches[0];
        
        if (topMatch.score < minConfidence) {
          result.lowConfidence++;
          continue;
        }
        
        // Track by band type
        if (topMatch.bandType === 'ALL_STAR') {
          result.matchedAllStar++;
        } else {
          result.matchedHBCU++;
        }
        
        // Check for battle
        const isBattle = this.isBattleVideo(searchText);
        let opponentBandId: string | null = null;
        
        if (isBattle && matches.length >= 2) {
          const secondMatch = matches.find((m) => m.bandId !== topMatch.bandId);
          if (secondMatch && secondMatch.score >= minConfidence) {
            opponentBandId = secondMatch.bandId;
            result.battleVideos++;
          } else {
            result.singleBand++;
          }
        } else {
          result.singleBand++;
        }
        
        // Update database
        try {
          await this.databaseService.prisma.youTubeVideo.update({
            where: { id: video.id },
            data: {
              bandId: topMatch.bandId,
              opponentBandId,
              qualityScore: topMatch.score,
            },
          });
        } catch (error) {
          result.errors.push(`Error updating ${video.youtubeId}: ${getErrorMessage(error)}`);
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
    
    const totalMatched = result.matchedHBCU + result.matchedAllStar;
    const matchRate = result.totalProcessed > 0
      ? ((totalMatched / result.totalProcessed) * 100).toFixed(1)
      : '0';
    
    this.logger.log(
      `Completed video matching: ${result.totalProcessed} processed, ` +
      `${totalMatched} matched (${matchRate}%), ` +
      `${result.excluded} excluded, ${result.noMatch} no match`
    );
    
    return result;
  }
  
  private generateAliasesForBands(bands: any[]): BandWithAliases[] {
    // Create a map of school names to HBCU config for quick lookup
    const hbcuConfigMap = new Map();
    for (const hbcu of this.hbcuBands) {
      hbcuConfigMap.set(hbcu.school.toLowerCase(), hbcu);
    }
    
    return bands.map((band) => {
      const isAllStar = band.bandType === 'ALL_STAR' ||
                       band.name.toLowerCase().includes('all-star') ||
                       band.name.toLowerCase().includes('mass band');
      
      let aliases: string[];
      
      if (isAllStar) {
        aliases = this.generateAllStarAliases(band.name);
      } else {
        // Try to find HBCU config for this band
        const hbcuConfig = hbcuConfigMap.get(band.schoolName.toLowerCase());
        
        if (hbcuConfig) {
          aliases = this.generateHBCUAliases(hbcuConfig);
        } else {
          // Fallback: basic aliases
          aliases = [
            band.name.toLowerCase(),
            band.schoolName.toLowerCase(),
          ];
        }
      }
      
      return {
        ...band,
        bandType: isAllStar ? 'ALL_STAR' : 'HBCU',
        aliases,
      };
    });
  }
  
  private generateHBCUAliases(hbcuConfig: BandChannelConfig): string[] {
    const aliases = new Set<string>();
    
    // Add band name
    aliases.add(hbcuConfig.name.toLowerCase());
    
    // Add school name
    aliases.add(hbcuConfig.school.toLowerCase());
    
    // Add all keywords from config
    for (const keyword of hbcuConfig.keywords) {
      aliases.add(keyword.toLowerCase());
    }
    
    // Extract band nickname from full name
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
    
    // Generate acronym from school
    const schoolWords = hbcuConfig.school
      .replace(/&/g, 'and')
      .split(/\s+/)
      .filter((w) => !['of', 'the', 'at', 'and'].includes(w.toLowerCase()));
    
    const acronym = schoolWords.map((w) => w[0]).join('').toLowerCase();
    if (acronym.length >= 2 && acronym.length <= 5) {
      aliases.add(acronym);
    }
    
    return Array.from(aliases).filter((a) => a.length >= 3);
  }
  
  private generateAllStarAliases(bandName: string): string[] {
    const allStarBand = this.allStarConfig?.allStarBands?.find(
      (b: any) => b.name.toLowerCase() === bandName.toLowerCase()
    );
    
    if (allStarBand) {
      return [
        allStarBand.name.toLowerCase(),
        ...allStarBand.aliases.map((a: string) => a.toLowerCase()),
      ];
    }
    
    return [bandName.toLowerCase()];
  }
  
  private shouldExclude(text: string): { exclude: boolean; reason?: string } {
    if (!this.allStarConfig?.exclusionPatterns) {
      return { exclude: false };
    }
    
    const lowerText = text.toLowerCase();
    
    for (const pattern of this.allStarConfig.exclusionPatterns.highSchool || []) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return { exclude: true, reason: 'high_school' };
      }
    }
    
    for (const pattern of this.allStarConfig.exclusionPatterns.middleSchool || []) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return { exclude: true, reason: 'middle_school' };
      }
    }
    
    for (const pattern of this.allStarConfig.exclusionPatterns.podcasts || []) {
      if (pattern.startsWith(' ')) {
        const regex = new RegExp(pattern.trim(), 'i');
        if (regex.test(lowerText)) {
          return { exclude: true, reason: 'podcast_show' };
        }
      } else if (lowerText.includes(pattern.toLowerCase())) {
        return { exclude: true, reason: 'podcast_show' };
      }
    }
    
    for (const pattern of this.allStarConfig.exclusionPatterns.generic || []) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return { exclude: true, reason: 'generic_content' };
      }
    }
    
    return { exclude: false };
  }
  
  private findEventMatches(searchText: string, bandsWithAliases: BandWithAliases[]): MatchResult[] {
    const lowerText = searchText.toLowerCase();
    const matches: MatchResult[] = [];
    
    for (const [event, participants] of Object.entries(EVENT_PARTICIPANTS)) {
      if (lowerText.includes(event)) {
        // Event detected, try to match participating bands
        for (const participant of participants) {
          const band = bandsWithAliases.find(b => 
            b.name.toLowerCase().includes(participant.toLowerCase()) ||
            b.schoolName.toLowerCase().includes(participant.toLowerCase())
          );
          
          if (band) {
            matches.push({
              bandId: band.id,
              bandName: band.name,
              bandType: band.bandType,
              score: 85, // High score for event-based matching
              matchedAlias: event,
              matchType: 'event',
            });
          }
        }
        
        // If we found matches via event, return them
        if (matches.length > 0) {
          return matches;
        }
      }
    }
    
    return [];
  }
  
  private findMatches(searchText: string, bandsWithAliases: BandWithAliases[]): MatchResult[] {
    const matches: MatchResult[] = [];
    const lowerText = searchText.toLowerCase();
    
    for (const band of bandsWithAliases) {
      let bestScore = 0;
      let bestAlias = '';
      let bestMatchType: MatchResult['matchType'] = 'abbreviation';
      
      for (const alias of band.aliases) {
        if (alias.length < 3) continue;
        
        let found = false;
        if (alias.length <= 4) {
          // Short alias - use word boundary
          const regex = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i');
          found = regex.test(lowerText);
        } else {
          found = lowerText.includes(alias);
        }
        
        if (found) {
          let score = 0;
          let matchType: MatchResult['matchType'] = 'abbreviation';
          
          // Score based on match type and band type
          if (band.bandType === 'ALL_STAR') {
            if (alias === band.name.toLowerCase()) {
              score = 110;
              matchType = 'all_star';
            } else if (alias.length >= 4) {
              score = 90;
              matchType = 'all_star';
            } else {
              score = 70;
              matchType = 'all_star';
            }
          } else {
            // HBCU scoring
            if (alias === band.name.toLowerCase()) {
              score = 100;
              matchType = 'exact_band_name';
            } else if (alias === band.schoolName.toLowerCase()) {
              score = 80;
              matchType = 'school_name';
            } else if (alias.length >= 8) {
              score = 60;
              matchType = 'partial';
            } else if (alias.length >= 5) {
              score = 50;
              matchType = 'partial';
            } else {
              score = 30;
              matchType = 'abbreviation';
            }
          }
          
          // Boost if in first 200 chars
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
          bandType: band.bandType,
          score: bestScore,
          matchedAlias: bestAlias,
          matchType: bestMatchType,
        });
      }
    }
    
    return matches.sort((a, b) => b.score - a.score);
  }
  
  private isBattleVideo(text: string): boolean {
    const lowerText = text.toLowerCase();
    return BATTLE_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
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
