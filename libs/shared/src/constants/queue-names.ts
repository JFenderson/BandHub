export const QUEUE_NAMES = {
  YOUTUBE_SYNC: 'youtube-sync',
  VIDEO_PROCESS: 'video-process',
  VIDEO_SYNC: 'video-sync',
  VIDEO_PROCESSING: 'video-processing',
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];