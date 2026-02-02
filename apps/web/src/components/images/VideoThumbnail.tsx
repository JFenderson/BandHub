import Image from 'next/image';

interface VideoThumbnailProps {
  src: string | null | undefined;
  alt: string;
  /** Band name for more descriptive alt text (e.g., "Southern University" ) */
  bandName?: string;
  /** Event name for context (e.g., "Bayou Classic 2024") */
  eventName?: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

/**
 * Generates descriptive alt text for video thumbnails
 * Format: "{title}" or "{band} performing at {event}" when context is available
 */
function generateAltText(alt: string, bandName?: string, eventName?: string): string {
  if (bandName && eventName) {
    return `${bandName} performing at ${eventName}: ${alt}`;
  }
  if (bandName) {
    return `${bandName}: ${alt}`;
  }
  // Ensure alt text is meaningful for thumbnails
  if (alt) {
    return `Video thumbnail: ${alt}`;
  }
  return 'Video thumbnail';
}

/**
 * Optimized video thumbnail component using Next.js Image
 * Default size: 480x270 (16:9 aspect ratio)
 * Includes lazy loading and blur placeholder
 *
 * For better accessibility, provide bandName and/or eventName props
 * to generate more descriptive alt text for screen readers.
 */
export function VideoThumbnail({
  src,
  alt,
  bandName,
  eventName,
  className = '',
  priority = false,
  width = 480,
  height = 270
}: VideoThumbnailProps) {
  const thumbnailUrl = src || '/placeholder-video.jpg';
  const descriptiveAlt = generateAltText(alt, bandName, eventName);

  return (
    <Image
      src={thumbnailUrl}
      alt={descriptiveAlt}
      width={width}
      height={height}
      className={className}
      quality={85}
      loading={priority ? undefined : 'lazy'}
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI3MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI3MCIgZmlsbD0iIzFhMWExYSIvPjwvc3ZnPg=="
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
