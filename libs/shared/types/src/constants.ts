

import type { VideoCategory } from './video-categories';

export const QUEUE_NAMES = {
  YOUTUBE_SYNC: 'video-sync',
  VIDEO_PROCESSING: 'video-processing',
  MAINTENANCE: 'maintenance',
} as const;

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'FIFTH_QUARTER',
  'FIELD_SHOW',
  'STAND_BATTLE',
  'PARADE',
  'PRACTICE',
  'CONCERT_BAND',
  'HALFTIME',
  'ENTRANCE',
  'PREGAME',
  'OTHER',
];

export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  FIFTH_QUARTER: '5th Quarter',
  FIELD_SHOW: 'Field Show',
  STAND_BATTLE: 'Stand Battle',
  PARADE: 'Parade',
  PRACTICE: 'Practice',
  CONCERT_BAND: 'Concert Band',
  HALFTIME: 'Halftime Show',
  ENTRANCE: 'Entrance',
  PREGAME: 'Pregame',
  OTHER: 'Other',
};