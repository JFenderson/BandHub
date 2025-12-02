import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BandCard } from '@/components/bands/BandCard';
import { VideoCard } from '@/components/videos/VideoCard';
import FeaturedBandsCarousel from '@/components/home/FeaturedBandsCarousel';

export default async function HomePage() {
  // Fetch featured content - using try/catch for resilience
  const [bandsResult, videosResult, categoriesResult] = await Promise.allSettled([
    apiClient.getBands({ limit: 10 }),
    apiClient.getVideos({ limit: 10, sortBy: 'publishedAt', sortOrder: 'desc' }),
    apiClient.getCategories(),
  ]);

  const bands = bandsResult.status === 'fulfilled' ? bandsResult.value.data : [];
  const videos = videosResult.status === 'fulfilled' ? videosResult.value.data : [];
  const categories = categoriesResult.status === 'fulfilled' 
    ? categoriesResult.value.slice(0, 6)  // Limit to 6 for display
    : [];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 text-white">
        <div className="container-custom py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Celebrate the Excellence of HBCU Marching Bands
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8">
              Discover performances, explore band profiles, and experience the rich tradition 
              of Historically Black College and University marching bands.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/bands" className="btn-primary bg-white text-primary-700 hover:bg-gray-100">
                Explore Bands
              </Link>
              <Link href="/videos" className="btn-secondary bg-transparent text-white border-white hover:bg-white/10">
                Watch Videos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Bands Carousel */}
      <FeaturedBandsCarousel />

      {/* All Bands Section */}
      <section className="py-16 bg-gray-50">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Explore More Bands</h2>
              <p className="text-gray-600 mt-2">Discover HBCU marching band programs</p>
            </div>
            <Link href="/bands" className="text-primary-600 hover:text-primary-700 font-medium">
              View All →
            </Link>
          </div>

          {bands.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bands.map((band) => (
                <BandCard key={band.id} band={band} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No bands available yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Videos Section */}
      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Recent Performances</h2>
              <p className="text-gray-600 mt-2">Latest videos from HBCU bands</p>
            </div>
            <Link href="/videos" className="text-primary-600 hover:text-primary-700 font-medium">
              View All →
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
              <p className="text-gray-500">No videos available yet. Check back soon!</p>
            </div>
          )}
        </div>

        {/* Categories Preview */}
  {categories.length > 0 && (
    <div className="mt-16">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Link
            key={category. slug}
            href={`/videos?category=${category.slug}`}
            className="bg-gradient-to-br from-gray-50 to-gray-100 hover:from-primary-50 hover:to-primary-100 border border-gray-200 hover:border-primary-300 rounded-lg p-6 text-center transition-all group"
          >
            <p className="font-medium text-gray-900 group-hover:text-primary-700">
              {category.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )}
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">100+</div>
              <div className="text-gray-400">HBCU Bands</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">10K+</div>
              <div className="text-gray-400">Videos</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">50+</div>
              <div className="text-gray-400">Years of History</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">Daily</div>
              <div className="text-gray-400">New Content</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}