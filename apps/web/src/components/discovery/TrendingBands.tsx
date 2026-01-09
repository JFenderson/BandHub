'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Share2,
  Play,
  MapPin,
  Calendar,
  Eye,
  Users,
  Heart,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface TrendingBand {
  id: string;
  name: string;
  nickname: string;
  state: string;
  conference: string;
  logoUrl: string | null;
  metrics: {
    totalViews: number;
    viewsTrending: number;
    trendingScore: number;
    trendDirection: 'UP' | 'DOWN' | 'STABLE' | 'NEW';
    rankChange: number | null;
    videoCount: number;
    recentUploads: number;
    followerCount: number;
    favoriteCount: number;
  };
  latestVideos: Array<{
    id: string;
    title: string;
    thumbnailUrl: string;
    viewCount: number;
    publishedAt: string;
  }>;
}

interface TrendingBandsProps {
  initialTimeframe?: 'today' | 'week' | 'month' | 'all-time';
  initialState?: string;
  initialConference?: string;
  initialCategory?: string;
  limit?: number;
}

export function TrendingBands({
  initialTimeframe = 'week',
  initialState,
  initialConference,
  initialCategory,
  limit = 20,
}: TrendingBandsProps) {
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [stateFilter, setStateFilter] = useState(initialState || '');
  const [conferenceFilter, setConferenceFilter] = useState(initialConference || '');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory || '');
  const [bands, setBands] = useState<TrendingBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Fetch trending bands
  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      
      const params = new URLSearchParams({
        timeframe,
        limit: limit.toString(),
      });
      
      if (stateFilter) params.set('state', stateFilter);
      if (conferenceFilter) params.set('conference', conferenceFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      try {
        const response = await fetch(`/api/bands/trending?${params}`);
        const data = await response.json();
        setBands(data);
      } catch (error) {
        console.error('Error fetching trending bands:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [timeframe, stateFilter, conferenceFilter, categoryFilter, limit]);

  // Handle favorite toggle
  const handleFavorite = async (bandId: string) => {
    const isFavorited = favorites.has(bandId);
    
    try {
      if (isFavorited) {
        await fetch(`/api/bands/trending/${bandId}/favorite`, {
          method: 'DELETE',
        });
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(bandId);
          return next;
        });
      } else {
        await fetch(`/api/bands/trending/${bandId}/favorite`, {
          method: 'POST',
        });
        setFavorites((prev) => new Set(prev).add(bandId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Handle share
  const handleShare = async (band: TrendingBand, platform: string) => {
    const url = `${window.location.origin}/bands/${band.id}`;
    const text = `Check out ${band.name} on HBCU Band Hub!`;

    try {
      if (platform === 'native' && navigator.share) {
        await navigator.share({ title: band.name, text, url });
      } else {
        // Platform-specific sharing
        const shareUrls: Record<string, string> = {
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        };

        if (shareUrls[platform]) {
          window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        }
      }

      // Track share
      await fetch(`/api/bands/trending/${band.id}/share?platform=${platform}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Trending Bands</h2>
          <p className="mt-1 text-gray-600">
            Most popular HBCU bands based on recent activity
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Timeframe */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all-time">All Time</option>
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All States</option>
            <option value="AL">Alabama</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="NC">North Carolina</option>
            <option value="SC">South Carolina</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            {/* Add more states */}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="5th Quarter">5th Quarter</option>
            <option value="Field Show">Field Show</option>
            <option value="Stand Battle">Stand Battle</option>
            <option value="Parade">Parade</option>
            <option value="Practice">Practice</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 p-6"
            >
              <div className="h-20 w-20 rounded-full bg-gray-200" />
              <div className="mt-4 h-6 bg-gray-200 rounded" />
              <div className="mt-2 h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Trending Bands Grid */}
      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div
            key={`${timeframe}-${stateFilter}-${categoryFilter}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {bands.map((band, index) => (
              <TrendingBandCard
                key={band.id}
                band={band}
                rank={index + 1}
                isFavorited={favorites.has(band.id)}
                onFavorite={() => handleFavorite(band.id)}
                onShare={handleShare}
                onHover={setHoveredBand}
                isHovered={hoveredBand === band.id}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!loading && bands.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">No trending bands found for these filters.</p>
        </div>
      )}
    </div>
  );
}

// Individual Band Card Component
interface TrendingBandCardProps {
  band: TrendingBand;
  rank: number;
  isFavorited: boolean;
  onFavorite: () => void;
  onShare: (band: TrendingBand, platform: string) => void;
  onHover: (id: string | null) => void;
  isHovered: boolean;
}

function TrendingBandCard({
  band,
  rank,
  isFavorited,
  onFavorite,
  onShare,
  onHover,
  isHovered,
}: TrendingBandCardProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);

  const getTrendIcon = () => {
    switch (band.metrics.trendDirection) {
      case 'UP':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'DOWN':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'NEW':
        return <Star className="h-5 w-5 text-yellow-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onHoverStart={() => onHover(band.id)}
      onHoverEnd={() => onHover(null)}
      className="group relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg"
    >
      {/* Rank Badge */}
      <div className="absolute -top-3 -left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-lg">
        #{rank}
      </div>

      {/* Trend Indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        {getTrendIcon()}
        {band.metrics.rankChange !== null && (
          <span
            className={`text-sm font-medium ${
              band.metrics.rankChange > 0
                ? 'text-green-600'
                : band.metrics.rankChange < 0
                ? 'text-red-600'
                : 'text-gray-500'
            }`}
          >
            {band.metrics.rankChange > 0 && '+'}
            {band.metrics.rankChange}
          </span>
        )}
      </div>

      {/* Band Logo */}
      <Link href={`/bands/${band.id}`}>
        <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-gray-100 transition-transform group-hover:scale-110">
          {band.logoUrl ? (
            <Image
              src={band.logoUrl}
              alt={band.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 text-2xl font-bold text-white">
              {band.name[0]}
            </div>
          )}
        </div>
      </Link>

      {/* Band Info */}
      <div className="mt-4 text-center">
        <Link href={`/bands/${band.id}`}>
          <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600">
            {band.name}
          </h3>
        </Link>
        <p className="text-sm text-gray-600">{band.nickname}</p>
        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          <span>
            {band.state} • {band.conference}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Eye className="h-3 w-3" />
            <span className="text-xs font-medium">Views</span>
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatNumber(band.metrics.viewsTrending)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Play className="h-3 w-3" />
            <span className="text-xs font-medium">Videos</span>
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {band.metrics.videoCount}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Heart className="h-3 w-3" />
            <span className="text-xs font-medium">Favorites</span>
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatNumber(band.metrics.favoriteCount)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Calendar className="h-3 w-3" />
            <span className="text-xs font-medium">New</span>
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {band.metrics.recentUploads}
          </p>
        </div>
      </div>

      {/* Latest Videos Preview (on hover) */}
      <AnimatePresence>
        {isHovered && band.latestVideos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2 overflow-hidden"
          >
            <p className="text-xs font-medium text-gray-700">Latest Videos</p>
            {band.latestVideos.slice(0, 2).map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="flex gap-2 rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
              >
                <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded">
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {video.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(video.viewCount)} views
                  </p>
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onFavorite}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
            isFavorited
              ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Heart
            className={`mx-auto h-4 w-4 ${isFavorited ? 'fill-current' : ''}`}
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" />
          </button>

          {showShareMenu && (
            <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  onShare(band, 'twitter');
                  setShowShareMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                Share on Twitter
              </button>
              <button
                onClick={() => {
                  onShare(band, 'facebook');
                  setShowShareMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                Share on Facebook
              </button>
              <button
                onClick={() => {
                  onShare(band, 'native');
                  setShowShareMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                Share...
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}