'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GripVertical, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { PlaylistVideo } from '@/lib/api/playlists';

interface PlaylistVideoItemProps {
  playlistVideo: PlaylistVideo;
  onRemove?: (videoId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, videoId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetVideoId: string) => void;
}

export function PlaylistVideoItem({
  playlistVideo,
  onRemove,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: PlaylistVideoItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const video = playlistVideo.video;

  if (!video) {
    return null;
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isRemoving) return;

    setIsRemoving(true);
    try {
      await onRemove?.(playlistVideo.videoId);
    } catch (error) {
      console.error('Failed to remove video:', error);
      setIsRemoving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart?.(e, playlistVideo.videoId);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    onDragEnd?.(e);
  };

  return (
    <div
      className={`
        group relative flex items-center gap-3 p-3 
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
        hover:shadow-md transition-all
        ${isDragging ? 'opacity-50' : ''}
      `}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, playlistVideo.videoId);
      }}
    >
      {/* Drag handle */}
      {draggable && (
        <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <GripVertical className="w-5 h-5" aria-label="Drag to reorder" />
        </div>
      )}

      {/* Thumbnail */}
      <Link
        href={`/videos/${video.id}`}
        className="relative flex-shrink-0 w-40 aspect-video bg-gray-900 rounded overflow-hidden"
      >
        <Image
          src={video.thumbnailUrl || '/placeholder-video.jpg'}
          alt={video.title}
          fill
          className="object-cover group-hover:opacity-90 transition-opacity"
          sizes="160px"
        />

        {/* Duration */}
        {video.duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </Link>

      {/* Video info */}
      <div className="flex-1 min-w-0">
        <Link href={`/videos/${video.id}`}>
          <h4 className="font-medium text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2 mb-1">
            {video.title}
          </h4>
        </Link>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Added {formatDistanceToNow(new Date(playlistVideo.addedAt), { addSuffix: true })}
        </p>

        {video.publishedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Published {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Remove from playlist"
          title="Remove from playlist"
        >
          {isRemoving ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <X className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
}

// Helper function to format duration from seconds
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
