'use client';

import { useState } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
}

export function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
      {!isLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          role="status"
          aria-label="Loading video player"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" aria-hidden="true" />
          <span className="sr-only">Loading video player...</span>
        </div>
      )}
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
        title={`YouTube video player: ${title}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        onLoad={() => setIsLoaded(true)}
        aria-label={`Video: ${title}`}
      />
    </div>
  );
}