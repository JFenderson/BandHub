// All the queue types from earlier
export enum QueueName {
  VIDEO_SYNC = 'video-sync',
  VIDEO_PROCESSING = 'video-processing',
  MAINTENANCE = 'maintenance',
}

export enum JobType {
  SYNC_BAND = 'sync-band',
  SYNC_ALL_BANDS = 'sync-all-bands',
  PROCESS_VIDEO = 'process-video',
  CLEANUP_VIDEOS = 'cleanup-videos',
  UPDATE_STATS = 'update-stats',
  BACKFILL_CREATORS = 'backfill-creators',
  BACKFILL_BANDS = 'backfill-bands',
  MATCH_VIDEOS = 'match-videos',
  PROMOTE_VIDEOS = 'promote-videos',
}

export enum JobPriority {
  CRITICAL = 1,
  HIGH = 5,
  NORMAL = 10,
  LOW = 15,
}

export enum SyncMode {
  INCREMENTAL = 'INCREMENTAL_SYNC',
  FULL = 'FULL_SYNC',
}

export interface SyncBandJobData {
  type: JobType.SYNC_BAND;
  bandId: string;
  mode: SyncMode;
  triggeredBy: 'admin' | 'schedule' | 'system';
  maxResults?: number;
  priority?: JobPriority;
}

export interface SyncAllBandsJobData {
  type: JobType.SYNC_ALL_BANDS;
  mode: SyncMode;
  triggeredBy: 'admin' | 'schedule';
  batchSize?: number;
  priority?: JobPriority;
}

export interface ProcessVideoJobData {
  type: JobType.PROCESS_VIDEO;
  videoId: string;
  bandId: string;
  rawMetadata: YouTubeVideoMetadata;
  isUpdate: boolean;
  priority?: JobPriority;
}

export interface CleanupVideosJobData {
  type: JobType.CLEANUP_VIDEOS;
  scope: 'duplicates' | 'irrelevant' | 'deleted' | 'all';
  dryRun?: boolean;
  priority?: JobPriority;
}

export interface UpdateStatsJobData {
  type: JobType.UPDATE_STATS;
  videoIds?: string[];
  batchSize?: number;
  priority?: JobPriority;
}

export interface BackfillCreatorsJobData {
  type: JobType.BACKFILL_CREATORS;
  triggeredBy: 'admin' | 'schedule' | 'system';
  creatorId?: string;
  limit?: number;
  priority?: JobPriority;
}

export interface BackfillBandsJobData {
  type: JobType.BACKFILL_BANDS;
  triggeredBy: 'admin' | 'schedule' | 'system';
  bandId?: string;
  limit?: number;
  priority?: JobPriority;
}

export interface MatchVideosJobData {
  type: JobType.MATCH_VIDEOS;
  triggeredBy: 'admin' | 'schedule' | 'system';
  limit?: number;
  minConfidence?: number;
  priority?: JobPriority;
}

export interface PromoteVideosJobData {
  type: JobType.PROMOTE_VIDEOS;
  triggeredBy: 'admin' | 'schedule' | 'system';
  limit?: number;
  priority?: JobPriority;
}

export type JobData =
  | SyncBandJobData
  | SyncAllBandsJobData
  | ProcessVideoJobData
  | CleanupVideosJobData
  | UpdateStatsJobData
  | BackfillCreatorsJobData
  | BackfillBandsJobData
  | MatchVideosJobData
  | PromoteVideosJobData;

export interface YouTubeVideoMetadata {
  id: string;
  snippet: {
    title: string;
    description: string | null;  // ← Changed to allow null
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnails: {
      default?: {
        url?: string | null;      // ← Changed to allow null/undefined
        width?: number | null;    // ← Changed to allow null/undefined
        height?: number | null;   // ← Changed to allow null/undefined
      };
      medium?: {
        url?: string | null;      // ← Changed to allow null/undefined
        width?: number | null;    // ← Changed to allow null/undefined
        height?: number | null;   // ← Changed to allow null/undefined
      };
      high?: {
        url?: string | null;      // ← Changed to allow null/undefined
        width?: number | null;    // ← Changed to allow null/undefined
        height?: number | null;   // ← Changed to allow null/undefined
      };
    };
    tags?: string[];
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount?: string | null;    // ← Changed to allow null
    commentCount?: string | null; // ← Changed to allow null
  };
}

export interface SyncJobResult {
  bandId: string;
  bandName: string;
  videosFound: number;
  videosCreated: number;
  videosUpdated: number;
  videosSkipped: number;
  errors: string[];
  duration: number;
}

export interface JobProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
}