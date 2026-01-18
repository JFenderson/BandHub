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

  return (
    <Link
      href={`/bands/${band.slug}`}
      className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Band Image */}
      <div className="relative aspect-video bg-gradient-to-br from-primary-100 to-secondary-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={band.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary-600">
              {band.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Band Info */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
          {band.schoolName || band.school} - {band.name}
        </h3>
        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
          {locationText}
        </p>
        
        {/* Stats */}
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