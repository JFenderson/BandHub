import Image from 'next/image';

interface UserAvatarProps {
  src: string | null | undefined;
  /** User's name - used for alt text and fallback initial */
  alt: string;
  size?: number;
  className?: string;
}

/**
 * Generates descriptive alt text for user avatars
 */
function generateAltText(userName: string): string {
  if (!userName) {
    return 'User avatar';
  }
  return `${userName}'s profile picture`;
}

/**
 * Optimized user avatar component with fallback to initials
 * Provides proper ARIA attributes for accessibility
 */
export function UserAvatar({ src, alt, size = 32, className = '' }: UserAvatarProps) {
  const descriptiveAlt = generateAltText(alt);

  if (!src) {
    return (
      <div
        className={`bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={descriptiveAlt}
      >
        <span className="text-white text-sm font-bold" aria-hidden="true">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={descriptiveAlt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      quality={85}
      loading="lazy"
    />
  );
}
