'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlaylistVideoItem } from './PlaylistVideoItem';
import type { PlaylistVideo } from '@/lib/api/playlists';

interface SortablePlaylistVideoProps {
  playlistVideo: PlaylistVideo;
  onRemove?: (videoId: string) => void;
}

export function SortablePlaylistVideo({ playlistVideo, onRemove }: SortablePlaylistVideoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlistVideo.videoId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        {/* Drag handle - positioned absolutely over the grip icon area */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing p-2"
          aria-label="Drag to reorder"
        >
          <svg
            className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>

        {/* Video item with left padding to accommodate drag handle */}
        <div className="pl-10">
          <PlaylistVideoItem
            playlistVideo={playlistVideo}
            onRemove={onRemove}
          />
        </div>
      </div>
    </div>
  );
}
