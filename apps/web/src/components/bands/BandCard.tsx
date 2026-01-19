import Link from 'next/link';
import Image from 'next/image';
import type { Band } from '@/types/api';
import { getFullImageUrl } from '@/lib/utils/image-url';

interface BandCardProps {
  band: Band;
}

export function BandCard({ band }: BandCardProps) {
  // Get display text - use city/state if available
  const locationText = band.city && band.state
    ? `${band.city}, ${band.state}`
    : band.state || '';

  const imageUrl = getFullImageUrl(band.logoUrl);

  // 1. Define the dynamic style
  const gradientStyle = band.primaryColor && band.secondaryColor
    ? { background: `linear-gradient(135deg, ${band.primaryColor} 0%, ${band.secondaryColor} 100%)` }
    : {}; // Fallback will be handled by className

  return (
    <Link
      href={`/bands/${band.slug}`}
      // Added group-hover:ring to highlight the card with the primary color on hover
      className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:ring-2 hover:ring-offset-2"
      style={{ '--tw-ring-color': band.primaryColor } as React.CSSProperties}
    >
      {/* Band Image */}
      {/* 2. Apply the dynamic style here */}
      <div 
        className={`relative aspect-video ${!band.primaryColor ? 'bg-gradient-to-br from-primary-100 to-secondary-100' : ''}`}
        style={gradientStyle}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={band.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/90">
             {/* 3. Update text color to be white/transparent since background is now colored */}
            <span className="text-4xl font-bold drop-shadow-md">
              {band.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Band Info */}
      <div className="p-4">
        <h3 
          className="font-bold text-lg text-gray-900 transition-colors line-clamp-2"
          // 4. Dynamic hover color for the title
          style={{ color: undefined }} // Reset style if needed, or use a specific class
        >
          {/* You can also wrap this text in a span and apply the color style on hover if you want strict dynamic coloring */}
          <span className="group-hover:text-[var(--hover-color)]" style={{ '--hover-color': band.primaryColor || '#0ea5e9' } as React.CSSProperties}>
            {band.schoolName || band.school} - {band.name}
          </span>
        </h3>
        
        {/* ... existing stats code ... */}
        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
          {locationText}
        </p>
        
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
             {/* ... svg icon ... */}
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