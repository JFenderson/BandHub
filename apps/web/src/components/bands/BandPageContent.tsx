'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import BandLogo from '@/components/bands/BandLogo';
import { BandVideosSection } from '@/components/bands/BandVideosSection';
import type { Band, Video } from '@/types/api';

interface BandPageContentProps {
  slug: string;
  initialBand: Band | null;
  initialVideos: Video[];
  initialTotal: number;
}

export function BandPageContent({ slug, initialBand, initialVideos, initialTotal }: BandPageContentProps) {
  const [band, setBand] = useState<Band | null>(initialBand);
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [totalVideos, setTotalVideos] = useState(initialTotal);
  const [loading, setLoading] = useState(initialBand === null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialBand !== null) return;

    async function fetchBand() {
      try {
        const fetchedBand = await apiClient.getBand(slug);
        setBand(fetchedBand);

        const videosResult = await apiClient.getVideos({
          bandId: fetchedBand.id,
          page: 1,
          limit: 12,
          sortBy: 'publishedAt',
          sortOrder: 'desc',
        });
        setVideos(videosResult.data);
        setTotalVideos(videosResult.meta.total);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchBand();
  }, [slug, initialBand]);

  if (loading) {
    return (
      <div className="bg-white animate-pulse">
        <div className="h-64 bg-gray-200" />
        <div className="container-custom py-12">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (notFound || !band) {
    return (
      <div className="container-custom py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Band not found</h1>
        <p className="text-gray-500">This band profile could not be loaded.</p>
      </div>
    );
  }

  const locationText = band.city && band.state
    ? `${band.city}, ${band.state}`
    : band.state || '';

  const headerStyle = band.primaryColor && band.secondaryColor
    ? { background: `linear-gradient(135deg, ${band.primaryColor} 0%, ${band.secondaryColor} 100%)` }
    : {};

  return (
    <div className="bg-white">
      {/* Band Header */}
      <div
        className={`text-white shadow-lg ${!band.primaryColor ? 'bg-gradient-to-br from-primary-600 to-secondary-700' : ''}`}
        style={headerStyle}
      >
        <div className="container-custom py-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Logo */}
            {band.logoUrl && (
              <div className="flex-shrink-0">
                <BandLogo
                  logoUrl={band.logoUrl}
                  bandName={band.name}
                  size="xl"
                  className="bg-white p-2"
                />
              </div>
            )}

            {/* Band Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{band.name}</h1>

              <div className="flex flex-wrap gap-4 text-sm">
                {locationText && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{locationText}</span>
                  </div>
                )}

                {band.youtubeChannelId && (
                  <a
                    href={`https://youtube.com/channel/${band.youtubeChannelId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>YouTube Channel</span>
                  </a>
                )}
              </div>

              {band.description && (
                <p className="mt-6 text-primary-50 leading-relaxed max-w-3xl">
                  {band.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b bg-gray-50">
        <div className="container-custom py-6">
          <div className="flex gap-8">
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalVideos}</div>
              <div className="text-sm text-gray-600">Videos</div>
            </div>
            {band.foundedYear && (
              <div>
                <div className="text-2xl font-bold text-gray-900">{band.foundedYear}</div>
                <div className="text-sm text-gray-600">Founded</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Videos Section with Infinite Scroll and Filtering */}
      <div className="container-custom py-12">
        <BandVideosSection
          bandId={band.id}
          bandName={band.name}
          initialVideos={videos}
          initialTotal={totalVideos}
        />
      </div>
    </div>
  );
}
