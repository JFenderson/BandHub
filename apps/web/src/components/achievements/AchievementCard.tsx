'use client';

import {
  PlayCircle,
  Heart,
  Users,
  Star,
  Lock,
  Trophy,
  Flame,
  Award,
  Check,
} from 'lucide-react';
import type { Achievement, AchievementRarity } from '@/lib/api/achievements';
import { RARITY_COLORS, RARITY_BORDER_COLORS, RARITY_LABELS } from '@/lib/api/achievements';

interface AchievementCardProps {
  achievement: Achievement;
  showProgress?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'play-circle': PlayCircle,
  heart: Heart,
  users: Users,
  star: Star,
  lock: Lock,
  trophy: Trophy,
  flame: Flame,
  award: Award,
  video: PlayCircle,
  tv: PlayCircle,
  film: PlayCircle,
  calendar: Flame,
  'calendar-check': Flame,
  music: Heart,
  crown: Star,
  gem: Star,
  bookmark: Heart,
  library: Heart,
  archive: Heart,
  'list-music': Heart,
  disc: Heart,
  'message-circle': Users,
  'messages-square': Users,
  edit: Users,
  'pen-tool': Users,
  'user-plus': Users,
  'users-round': Users,
  'share-2': Users,
  megaphone: Users,
  rocket: Star,
  cake: Star,
  badge: Star,
  shield: Star,
  'check-circle': Check,
};

function getIconComponent(iconName: string) {
  return iconMap[iconName] || Star;
}

export function AchievementCard({
  achievement,
  showProgress = true,
  onClick,
  size = 'md',
}: AchievementCardProps) {
  const Icon = getIconComponent(achievement.icon);
  const isLocked = !achievement.isUnlocked && achievement.slug === 'secret';
  const progress = achievement.progress || 0;
  const progressPercent = Math.min(100, (progress / achievement.criteriaValue) * 100);

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl border-2 transition-all
        ${RARITY_BORDER_COLORS[achievement.rarity]}
        ${achievement.isUnlocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
        ${sizeClasses[size]}
      `}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Rarity badge */}
      <div className={`
        absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium
        ${RARITY_COLORS[achievement.rarity]}
      `}>
        {RARITY_LABELS[achievement.rarity]}
      </div>

      {/* Unlocked indicator */}
      {achievement.isUnlocked && (
        <div className="absolute top-2 left-2">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      <div className="flex flex-col items-center text-center space-y-3 mt-4">
        {/* Icon */}
        <div className={`
          rounded-full p-3
          ${achievement.isUnlocked
            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}
        `}>
          <Icon className={iconSizes[size]} />
        </div>

        {/* Name and description */}
        <div>
          <h3 className={`font-bold text-gray-900 dark:text-white ${textSizes[size]}`}>
            {achievement.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {achievement.description}
          </p>
        </div>

        {/* Points */}
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Trophy className="w-4 h-4" />
          <span className="font-semibold">{achievement.points} pts</span>
        </div>

        {/* Progress bar */}
        {showProgress && !achievement.isUnlocked && achievement.criteriaType !== 'secret' && (
          <div className="w-full">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progress} / {achievement.criteriaValue}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Unlocked date */}
        {achievement.isUnlocked && achievement.unlockedAt && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton loader for achievement card
export function AchievementCardSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div className={`
      rounded-xl border-2 border-gray-200 dark:border-gray-700
      bg-gray-50 dark:bg-gray-900 animate-pulse
      ${sizeClasses[size]}
    `}>
      <div className="flex flex-col items-center space-y-3 mt-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}
