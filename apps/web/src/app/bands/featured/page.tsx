import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Featured Bands | HBCU Band Hub',
  description: 'Discover our highlighted HBCU marching bands. Explore featured performances from the best Historically Black College and University bands.',
};

interface FeaturedBand {
  id: string;
  name: string;
  school: string;
  description: string | null;
  logoUrl: string | null;
  slug: string;
  schoolColors?: {
    primary: string;
    secondary: string;
  };
  videoCount: number;
  featuredOrder: number;
}

export default async function FeaturedBandsPage() {
  let bands: FeaturedBand[] = [];

  try {
    const response = await apiClient.getFeaturedBands();
    bands = response.bands || [];
  } catch (error) {
    console.error('Failed to fetch featured bands:', error);
    bands = [];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-gradient-to-br from-primary-600 to-secondary-700 text-white">
        <div className="container-custom py-12">
          <h1 className="text-4xl font-bold mb-2">Featured Bands</h1>
          <p className="text-lg text-primary-100">
            Discover our highlighted HBCU marching bands
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-primary-600 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <span className="mx-2">/</span>
            </li>
            <li>
              <Link href="/bands" className="hover:text-primary-600 transition-colors">
                Bands
              </Link>
            </li>
            <li>
              <span className="mx-2">/</span>
            </li>
            <li className="text-gray-900 font-medium">Featured</li>
          </ol>
        </nav>

        {/* Featured Bands Grid */}
        {bands.length > 0 ? (
          <>
            <p className="text-gray-600 mb-6">
              Showing {bands.length} featured band{bands.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {bands.map((band) => (
                <FeaturedBandCard key={band.id} band={band} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No featured bands yet</h3>
            <p className="mt-2 text-gray-500">
              Check back soon for our highlighted HBCU marching bands.
            </p>
          </div>
        )}

        {/* View All Bands Link */}
        <div className="text-center mt-8">
          <Link
            href="/bands"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            View All Bands
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeaturedBandCard({ band }: { band: FeaturedBand }) {
  const truncateDescription = (text: string | null, maxLength: number = 100) => {
    if (!text) return 'Explore this amazing HBCU band and their performances.';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };

  const defaultPrimaryColor = '#1e3a5f';
  const defaultSecondaryColor = '#c5a900';

  return (
    <Link
      href={`/bands/${band.slug}`}
      className="group bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
      style={{
        borderTop: `4px solid ${band.schoolColors?.primary || defaultPrimaryColor}`,
      }}
    >
      {/* Band Header with Logo */}
      <div
        className="p-4 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${band.schoolColors?.primary || defaultPrimaryColor}20, ${band.schoolColors?.secondary || defaultSecondaryColor}20)`,
        }}
      >
        <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
          {band.logoUrl ? (
            <Image
              src={band.logoUrl}
              alt={`${band.name} logo`}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-xl font-bold text-gray-400">
                {band.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-primary-600 transition-colors">
            {band.name}
          </h3>
          <p className="text-sm text-gray-600 truncate">{band.school}</p>
        </div>
      </div>

      {/* Band Details */}
      <div className="p-4">
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {truncateDescription(band.description)}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{band.videoCount} videos</span>
          </div>
          {band.featuredOrder > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span>#{band.featuredOrder}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
