import Image from 'next/image';

interface VideoThumbnailProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

/**
 * Optimized video thumbnail component using Next.js Image
 * Default size: 480x270 (16:9 aspect ratio)
 * Includes lazy loading and blur placeholder
 */
export function VideoThumbnail({ 
  src, 
  alt, 
  className = '', 
  priority = false,
  width = 480,
  height = 270
}: VideoThumbnailProps) {
  const thumbnailUrl = src || '/placeholder-video.jpg';

  return (
    <Image
      src={thumbnailUrl}
      alt={alt}
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
