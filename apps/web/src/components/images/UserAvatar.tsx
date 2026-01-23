import Image from 'next/image';

interface UserAvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}

/**
 * Optimized user avatar component with fallback to initials
 */
export function UserAvatar({ src, alt, size = 32, className = '' }: UserAvatarProps) {
  if (!src) {
    return (
      <div 
        className={`bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-white text-sm font-bold">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      quality={85}
      loading="lazy"
    />
  );
}
