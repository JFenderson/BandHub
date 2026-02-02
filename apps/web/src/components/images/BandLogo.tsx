import Image from 'next/image';
import { getFullImageUrl } from '@/lib/utils/image-url';

interface BandLogoProps {
  src: string | null | undefined;
  /** Band name - used for descriptive alt text */
  alt: string;
  className?: string;
  size?: number;
  priority?: boolean;
}

/**
 * Generates descriptive alt text for band logos
 */
function generateAltText(bandName: string): string {
  if (!bandName) {
    return 'Band logo';
  }
  return `${bandName} marching band logo`;
}

/**
 * Optimized band logo component using Next.js Image
 * Provides consistent sizing, lazy loading, and blur placeholder
 */
export function BandLogo({
  src,
  alt,
  className = '',
  size = 300,
  priority = false
}: BandLogoProps) {
  const imageUrl = getFullImageUrl(src);
  const descriptiveAlt = generateAltText(alt);

  if (!imageUrl) {
    // Fallback to initials when no logo is available
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-primary-100 to-secondary-100 ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={descriptiveAlt}
      >
        <span className="text-4xl font-bold text-primary-700" aria-hidden="true">
          {alt.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={descriptiveAlt}
      width={size}
      height={size}
      className={className}
      quality={85}
      loading={priority ? undefined : 'lazy'}
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg=="
    />
  );
}
