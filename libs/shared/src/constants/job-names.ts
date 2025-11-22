export const JOB_NAMES = {
  SYNC_BAND: 'sync-band',
  SYNC_ALL_BANDS: 'sync-all-bands',
  PROCESS_VIDEO: 'process-video',
  CLEANUP_VIDEOS: 'cleanup-videos',
} as const;

export type JobName = typeof JOB_NAMES[keyof typeof JOB_NAMES];