import Link from 'next/link';
import type { Band } from '@/types/api';
import { BandLogo } from '@/components/images';

interface BandCardProps {
  band: Band;
}

export function BandCard({ band }: BandCardProps) {
  // Get display text - use city/state if available
  const locationText = band.city && band.state
    ? `${band.city}, ${band.state}`
    : band.state || '';

  // Validate and sanitize color values (must be valid hex colors)
  const isValidHexColor = (color: string | undefined | null): boolean => {
    if (!color) return false;
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const validPrimaryColor = isValidHexColor(band.primaryColor) ? band.primaryColor! : null;
  const validSecondaryColor = isValidHexColor(band.secondaryColor) ? band.secondaryColor! : null;

  // Define colors with fallbacks
  const hasBandColors = validPrimaryColor && validSecondaryColor;
  const primaryColor = validPrimaryColor || '#0ea5e9';
  const secondaryColor = validSecondaryColor || '#38bdf8';

  // Define gradient background style
  const gradientStyle = hasBandColors
    ? { background: `linear-gradient(135deg, ${validPrimaryColor} 0%, ${validSecondaryColor} 100%)` }
    : {};

  return (
    <Link
      href={`/bands/${band.slug}`}
      className="group bg-white rounded-lg border-2 overflow-hidden hover:shadow-xl transition-all duration-300"
      style={{
        borderColor: hasBandColors ? primaryColor : '#e5e7eb',
        '--primary-color': primaryColor,
        '--secondary-color': secondaryColor,
      } as React.CSSProperties}
    >
      {/* Band Image with color gradient background */}
      <div 
        className={`relative aspect-video ${!hasBandColors ? 'bg-gradient-to-br from-primary-100 to-secondary-100' : ''}`}
        style={gradientStyle}
      >
        <BandLogo
          src={band.logoUrl}
          alt={band.name}
          className="w-full h-full object-cover"
          size={300}
        />
        
        {/* Color accent bar at bottom of image */}
        {hasBandColors && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          />
        )}
      </div>

      {/* Band Info */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 transition-colors line-clamp-2 group-hover:opacity-80">
          {band.schoolName || band.school}
        </h3>
        
        <p className="text-sm font-medium mt-1 line-clamp-1" style={{ color: primaryColor }}>
          {band.nickname || band.name}
        </p>
        
        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
          {locationText}
        </p>
        
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{band._count?.videos || 0} videos</span>
          </div>
        </div>
      </div>
    </Link>
  );
}