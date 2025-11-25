'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

// Configuration constants
const CAROUSEL_CONFIG = {
  AUTO_ROTATE_INTERVAL: 5000, // 5 seconds
  DESCRIPTION_MAX_LENGTH: 150,
  DEFAULT_DESCRIPTION: 'Explore this amazing HBCU band and their performances.',
  DEFAULT_PRIMARY_COLOR: '#1e3a5f',
  DEFAULT_SECONDARY_COLOR: '#c5a900',
};

interface FeaturedBandVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
}

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
  recentVideos: FeaturedBandVideo[];
  featuredOrder: number;
}

export default function FeaturedBandsCarousel() {
  const [bands, setBands] = useState<FeaturedBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(4);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch featured bands
  useEffect(() => {
    const fetchFeaturedBands = async () => {
      try {
        const response = await apiClient.getFeaturedBands();
        setBands(response.bands || []);
      } catch (error) {
        console.error('Failed to fetch featured bands:', error);
        setBands([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedBands();
  }, []);

  // Handle responsive visible count
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setVisibleCount(4);
      } else if (width >= 768) {
        setVisibleCount(2);
      } else {
        setVisibleCount(1);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate max index for carousel navigation
  const calculateMaxIndex = useCallback(() => {
    return Math.max(0, bands.length - visibleCount);
  }, [bands.length, visibleCount]);

  // Auto-rotate carousel
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    autoPlayRef.current = setInterval(() => {
      if (!isPaused && bands.length > visibleCount) {
        setCurrentIndex((prev) => (prev + 1) % (calculateMaxIndex() + 1));
      }
    }, CAROUSEL_CONFIG.AUTO_ROTATE_INTERVAL);
  }, [isPaused, bands.length, visibleCount, calculateMaxIndex]);

  useEffect(() => {
    if (bands.length > visibleCount) {
      startAutoPlay();
    }
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [bands.length, visibleCount, startAutoPlay]);

  // Navigation handlers
  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    startAutoPlay();
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(calculateMaxIndex(), prev + 1));
    startAutoPlay();
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    startAutoPlay();
  };

  // Track click for analytics
  const handleBandClick = async (bandId: string) => {
    try {
      await apiClient.trackFeaturedClick(bandId);
    } catch (error) {
      // Silently fail - analytics shouldn't block navigation
      console.error('Failed to track click:', error);
    }
  };

  // Truncate description
  const truncateDescription = (text: string | null) => {
    if (!text) return CAROUSEL_CONFIG.DEFAULT_DESCRIPTION;
    if (text.length <= CAROUSEL_CONFIG.DESCRIPTION_MAX_LENGTH) return text;
    return text.slice(0, CAROUSEL_CONFIG.DESCRIPTION_MAX_LENGTH).trim() + '...';
  };

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="container-custom">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-8"></div>
              <div className="flex gap-6 justify-center">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-72 h-80 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (bands.length === 0) {
    return null; // Don't show section if no featured bands
  }

  const maxIndex = calculateMaxIndex();
  const dotCount = maxIndex + 1;

  return (
    <section className="py-12 bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Bands</h2>
          <p className="text-gray-600">Discover our highlighted HBCU marching bands</p>
        </div>

        {/* Carousel Container */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          ref={carouselRef}
        >
          {/* Navigation Arrows */}
          {bands.length > visibleCount && (
            <>
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                aria-label="Previous bands"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                disabled={currentIndex >= maxIndex}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                aria-label="Next bands"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Carousel Track */}
          <div className="overflow-hidden mx-4">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`,
              }}
            >
              {bands.map((band) => (
                <div
                  key={band.id}
                  className="flex-shrink-0 px-3"
                  style={{ width: `${100 / visibleCount}%` }}
                >
                  <div
                    className="bg-white rounded-xl shadow-lg overflow-hidden h-full hover:shadow-xl transition-shadow"
                    style={{
                      borderTop: `4px solid ${band.schoolColors?.primary || CAROUSEL_CONFIG.DEFAULT_PRIMARY_COLOR}`,
                    }}
                  >
                    {/* Band Header with Logo */}
                    <div
                      className="p-6 flex items-center gap-4"
                      style={{
                        background: `linear-gradient(135deg, ${band.schoolColors?.primary || CAROUSEL_CONFIG.DEFAULT_PRIMARY_COLOR}20, ${band.schoolColors?.secondary || CAROUSEL_CONFIG.DEFAULT_SECONDARY_COLOR}20)`,
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
                        {band.logoUrl ? (
                          <Image
                            src={band.logoUrl}
                            alt={`${band.name} logo`}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <span className="text-2xl font-bold text-gray-400">
                              {band.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg text-gray-900 truncate">{band.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{band.school}</p>
                      </div>
                    </div>

                    {/* Band Details */}
                    <div className="p-6">
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {truncateDescription(band.description)}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{band.videoCount} videos</span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <Link
                        href={`/bands/${band.slug}`}
                        onClick={() => handleBandClick(band.id)}
                        className="block w-full text-center py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dot Indicators */}
          {dotCount > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {[...Array(dotCount)].map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-primary-600 w-6'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* View All Link */}
        <div className="text-center mt-8">
          <Link
            href="/bands"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            View All Bands
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
