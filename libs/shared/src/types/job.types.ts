// Job type enum
export enum JobType {
  SYNC_BAND = 'SYNC_BAND',
  SYNC_ALL_BANDS = 'SYNC_ALL_BANDS',
  PROCESS_VIDEO = 'PROCESS_VIDEO',
  CLEANUP_VIDEOS = 'CLEANUP_VIDEOS',
}

// Sync mode enum
export enum SyncMode {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
  RECENT = 'RECENT',
}

// Job priority enum
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

// Job data interfaces
export interface SyncBandJobData {
  bandId: string;
  mode?: SyncMode;
  maxVideos?: number;
  force?: boolean;
}

export interface SyncAllBandsJobData {
  mode?: SyncMode;
  maxVideosPerBand?: number;
  batchSize?: number;
}

export interface ProcessVideoJobData {
  videoId: string;
  youtubeId: string;
  bandId: string;
}

export interface CleanupVideosJobData {
  daysOld?: number;
  dryRun?: boolean;
}

// Union type for all job data
export type JobData = 
  | SyncBandJobData 
  | SyncAllBandsJobData 
  | ProcessVideoJobData 
  | CleanupVideosJobData;