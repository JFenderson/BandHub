import Image from 'next/image';

interface BandLogoProps {
  logoUrl?: string | null;
  bandName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 40,
  md: 64,
  lg: 96,
  xl: 128,
};

export default function BandLogo({
  logoUrl,
  bandName,
  size = 'md',
  className = '',
}: BandLogoProps) {
  const pixelSize = sizeMap[size];

  // If no logo, show initials
  if (!logoUrl) {
    const initials = bandName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold rounded-lg ${className}`}
        style={{ width: pixelSize, height: pixelSize, fontSize: pixelSize / 3 }}
      >
        {initials}
      </div>
    );
  }

  // Build full URL for API-served images
  const imageUrl = logoUrl.startsWith('http')
    ? logoUrl
    : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <Image
        src={imageUrl}
        alt={`${bandName} logo`}
        fill
        className="object-contain"
        sizes={`${pixelSize}px`}
      />
    </div>
  );
}