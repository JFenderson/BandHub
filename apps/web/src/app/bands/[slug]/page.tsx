import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { VideoCard } from '@/components/videos/VideoCard';
import BandLogo from '@/components/bands/BandLogo';

interface BandPageProps {
  params: {
    slug: string;
  };
}

export default async function BandPage({ params }: BandPageProps) {
  let band;
  let videos;

  try {
    band = await apiClient.getBand(params.slug);
    const videosResult = await apiClient.getVideos({ 
      bandId: band.id, 
       page: 1,
      limit: 12,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });
    videos = videosResult.data;
  } catch (error) {
    notFound();
  }

  const locationText = band.city && band.state 
    ? `${band.city}, ${band.state}` 
    : band.state || '';

  return (
    <div className="bg-white">
      {/* Band Header */}
      <div className="bg-gradient-to-br from-primary-600 to-secondary-700 text-white">
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
              <div className="text-2xl font-bold text-gray-900">{videos.length}</div>
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

      {/* Videos Section */}
      <div className="container-custom py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Performances</h2>
          <Link 
            href={`/videos?bandId=${band.id}`}
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            View All Videos →
          </Link>
        </div>

        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">No videos available for this band yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}