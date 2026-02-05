import Image from 'next/image';

interface UserAvatarProps {
  src: string | null | undefined;
  /** User's name - used for alt text and fallback initial */
  alt: string;
  size?: number;
  className?: string;
  /** Show achievement badge indicator */
  showBadge?: boolean;
  /** Badge type/color - defaults to gold */
  badgeColor?: 'gold' | 'silver' | 'bronze';
  /** Badge count to display */
  badgeCount?: number;
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
 * Optional achievement badge indicator
 */
export function UserAvatar({ 
  src, 
  alt, 
  size = 32, 
  className = '', 
  showBadge = false,
  badgeColor = 'gold',
  badgeCount
}: UserAvatarProps) {
  const descriptiveAlt = generateAltText(alt);
  
  const badgeColorClasses = {
    gold: 'bg-gradient-to-br from-amber-400 to-amber-600',
    silver: 'bg-gradient-to-br from-gray-300 to-gray-500',
    bronze: 'bg-gradient-to-br from-orange-400 to-orange-600',
  };

  const avatarElement = !src ? (
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
  ) : (
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

  if (!showBadge) {
    return avatarElement;
  }

  // Badge size scales with avatar size
  const badgeSize = Math.max(12, size * 0.35);
  const badgeFontSize = Math.max(8, size * 0.25);

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {avatarElement}
      <div
        className={`absolute -bottom-0.5 -right-0.5 ${badgeColorClasses[badgeColor]} rounded-full flex items-center justify-center border-2 border-white shadow-lg`}
        style={{ width: badgeSize, height: badgeSize }}
        title={badgeCount ? `${badgeCount} achievements unlocked` : 'Achievement badge'}
        aria-label={badgeCount ? `${badgeCount} achievements unlocked` : 'Achievement badge'}
      >
        {badgeCount !== undefined ? (
          <span className="text-white font-bold" style={{ fontSize: `${badgeFontSize}px` }}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : (
          <svg
            className="text-white"
            style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
      </div>
    </div>
  );
}
