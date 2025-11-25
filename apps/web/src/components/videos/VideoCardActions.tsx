'use client';

import React from 'react';
import { FavoriteButton } from './FavoriteButton';
import { WatchLaterButton } from './WatchLaterButton';

interface VideoCardActionsProps {
  videoId: string;
  initialFavorited?: boolean;
  initialInWatchLater?: boolean;
  className?: string;
  onFavoriteToggle?: (favorited: boolean) => void;
  onWatchLaterToggle?: (inWatchLater: boolean) => void;
}

export function VideoCardActions({
  videoId,
  initialFavorited = false,
  initialInWatchLater = false,
  className = '',
  onFavoriteToggle,
  onWatchLaterToggle,
}: VideoCardActionsProps) {
  return (
    <div 
      className={`
        flex items-center space-x-1 
        opacity-0 group-hover:opacity-100 
        transition-opacity duration-200 
        ${className}
      `}
    >
      <FavoriteButton
        videoId={videoId}
        initialFavorited={initialFavorited}
        size="sm"
        onToggle={onFavoriteToggle}
      />
      <WatchLaterButton
        videoId={videoId}
        initialInWatchLater={initialInWatchLater}
        size="sm"
        onToggle={onWatchLaterToggle}
      />
    </div>
  );
}
