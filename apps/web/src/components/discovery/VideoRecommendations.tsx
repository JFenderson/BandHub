'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ThumbsUp,
  ThumbsDown,
  Info,
  ChevronRight,
  Eye,
  MapPin,
  Calendar,
  TrendingUp,
  Star,
  History,
  Sparkles,
  Users,
  Loader2,
} from 'lucide-react';

// ============ TypeScript Interfaces ============

interface Video {
  id: string;
  title: string;
  bandName: string;
  bandId: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  viewCount: number;
  uploadDate: string;
  category: string;
  eventName?: string;
  location?: string;
  tags: string[];
  trendingScore?: number;
}

interface RecommendationSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  videos: Video[];
  explanation: string;
  type: 'personalized' | 'trending' | 'discover' | 'seasonal' | 'geographic' | 'historical';
}

interface UserPreferences {
  watchedVideos: string[];
  likedVideos: string[];
  dislikedVideos: string[];
  favoriteBands: string[];
  preferredCategories: string[];
}

interface VideoRecommendationsProps {
  userId?: string;
  userLocation?: { city: string; state: string };
}

// ============ Mock Data Generator ============

const HBCU_BANDS = [
  { id: '1', name: 'Southern University Marching Band', state: 'LA', nickname: 'Human Jukebox' },
  { id: '2', name: 'Jackson State Sonic Boom', state: 'MS', nickname: 'Sonic Boom of the South' },
  { id: '3', name: 'Florida A&M Marching 100', state: 'FL', nickname: 'The Marching 100' },
  { id: '4', name: 'North Carolina A&T Blue and Gold Marching Machine', state: 'NC', nickname: 'BGMM' },
  { id: '5', name: 'Tennessee State Aristocrat of Bands', state: 'TN', nickname: 'Aristocrat of Bands' },
  { id: '6', name: 'Norfolk State Spartan Legion', state: 'VA', nickname: 'Spartan Legion' },
  { id: '7', name: 'Bethune-Cookman Marching Wildcats', state: 'FL', nickname: 'Marching Wildcats' },
  { id: '8', name: 'Alabama State Mighty Marching Hornets', state: 'AL', nickname: 'Mighty Marching Hornets' },
  { id: '9', name: 'Grambling State World Famed Tiger Marching Band', state: 'LA', nickname: 'World Famed' },
  { id: '10', name: 'Prairie View A&M Marching Storm', state: 'TX', nickname: 'Marching Storm' },
  { id: '11', name: 'Howard University Showtime Marching Band', state: 'DC', nickname: 'Showtime' },
  { id: '12', name: 'Morgan State Magnificent Marching Machine', state: 'MD', nickname: 'Magnificent Marching Machine' },
];

const CATEGORIES = ['5th Quarter', 'Field Show', 'Stand Battle', 'Parade', 'Halftime', 'Practice', 'Battle of the Bands'];

const EVENTS = [
  'Honda Battle of the Bands',
  'Southern Heritage Classic',
  'Magic City Classic',
  'Bayou Classic',
  'Florida Classic',
  'Turkey Day Classic',
  'Chicago Football Classic',
  'Homecoming',
  'Spring Concert',
  'MLK Day Parade',
];

function generateMockVideos(count: number): Video[] {
  const videos: Video[] = [];
  const currentYear = new Date().getFullYear();
  
  for (let i = 0; i < count; i++) {
    const band = HBCU_BANDS[Math.floor(Math.random() * HBCU_BANDS.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const event = Math.random() > 0.5 ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : undefined;
    
    // Generate dates from the past 2 years
    const daysAgo = Math.floor(Math.random() * 730);
    const uploadDate = new Date();
    uploadDate.setDate(uploadDate.getDate() - daysAgo);
    
    videos.push({
      id: `video-${i + 1}`,
      title: event 
        ? `${band.name} - ${event} ${currentYear - Math.floor(daysAgo / 365)}`
        : `${band.name} ${category} Performance`,
      bandName: band.name,
      bandId: band.id,
      thumbnailUrl: `https://via.placeholder.com/400x300/3b82f6/ffffff?text=${encodeURIComponent(band.nickname)}`,
      duration: Math.floor(Math.random() * 600) + 180, // 3-13 minutes
      viewCount: Math.floor(Math.random() * 500000) + 1000,
      uploadDate: uploadDate.toISOString(),
      category,
      eventName: event,
      location: `${Math.random() > 0.5 ? 'Atlanta' : 'New Orleans'}, ${band.state}`,
      tags: [category, band.state, event || 'Performance'].filter(Boolean),
      trendingScore: Math.random() * 100,
    });
  }
  
  return videos;
}

// ============ Recommendation Algorithm Functions ============

function getContentBasedRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  limit: number = 12
): Video[] {
  const watched = allVideos.filter(v => preferences.watchedVideos.includes(v.id));
  if (watched.length === 0) return [];
  
  // Get bands and categories from watched videos
  const watchedBands = [...new Set(watched.map(v => v.bandId))];
  const watchedCategories = [...new Set(watched.map(v => v.category))];
  
  // Score videos based on similarity
  const scoredVideos = allVideos
    .filter(v => !preferences.watchedVideos.includes(v.id) && !preferences.dislikedVideos.includes(v.id))
    .map(v => {
      let score = 0;
      if (watchedBands.includes(v.bandId)) score += 3;
      if (watchedCategories.includes(v.category)) score += 2;
      if (watched.some(w => w.eventName && w.eventName === v.eventName)) score += 2;
      return { video: v, score };
    })
    .filter(v => v.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scoredVideos.slice(0, limit).map(v => v.video);
}

function getCollaborativeRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  limit: number = 12
): Video[] {
  // Simulate collaborative filtering based on favorite bands and liked videos
  const favoriteVideos = allVideos.filter(v => 
    preferences.favoriteBands.includes(v.bandId) && 
    !preferences.watchedVideos.includes(v.id) &&
    !preferences.dislikedVideos.includes(v.id)
  );
  
  return favoriteVideos
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

function getTrendingRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  limit: number = 12
): Video[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return allVideos
    .filter(v => 
      !preferences.dislikedVideos.includes(v.id) &&
      new Date(v.uploadDate) > thirtyDaysAgo
    )
    .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
    .slice(0, limit);
}

function getSeasonalRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  currentMonth: number,
  limit: number = 12
): { videos: Video[], title: string, explanation: string } | null {
  let seasonalFilter: (v: Video) => boolean;
  let title: string;
  let explanation: string;
  
  // Determine season based on month
  if (currentMonth >= 8 && currentMonth <= 9) {
    // September-October: Homecoming season
    seasonalFilter = v => v.eventName?.toLowerCase().includes('homecoming') || false;
    title = '🏈 Homecoming Season';
    explanation = 'Top performances from homecoming celebrations across HBCU campuses';
  } else if (currentMonth === 10) {
    // November: Battle of the Bands season
    seasonalFilter = v => v.eventName?.toLowerCase().includes('battle') || v.eventName?.toLowerCase().includes('classic') || false;
    title = '⚔️ Battle of the Bands Season';
    explanation = 'Epic band battles and classic matchups happening now';
  } else if (currentMonth === 11) {
    // December: Holiday performances
    seasonalFilter = v => v.eventName?.toLowerCase().includes('holiday') || v.eventName?.toLowerCase().includes('christmas') || false;
    title = '🎄 Holiday Performances';
    explanation = 'Festive performances to celebrate the holiday season';
  } else if (currentMonth === 0) {
    // January: MLK Day events
    seasonalFilter = v => v.eventName?.toLowerCase().includes('mlk') || v.eventName?.toLowerCase().includes('martin luther king') || false;
    title = '✊ MLK Day Events';
    explanation = 'Honoring Dr. Martin Luther King Jr. with powerful performances';
  } else if (currentMonth === 1) {
    // February: Black History Month
    seasonalFilter = v => v.tags.some(t => t.toLowerCase().includes('black history')) || false;
    title = '📚 Black History Month';
    explanation = 'Celebrating Black excellence and HBCU culture';
  } else if (currentMonth >= 3 && currentMonth <= 4) {
    // April-May: Spring concert season
    seasonalFilter = v => v.eventName?.toLowerCase().includes('spring') || v.eventName?.toLowerCase().includes('concert') || false;
    title = '🌸 Spring Concert Season';
    explanation = 'Spring concerts and end-of-year performances';
  } else {
    return null; // No specific season
  }
  
  const videos = allVideos
    .filter(v => 
      !preferences.dislikedVideos.includes(v.id) && 
      seasonalFilter(v)
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
  
  return videos.length > 0 ? { videos, title, explanation } : null;
}

function getGeographicRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  userLocation: { city: string; state: string } | undefined,
  limit: number = 12
): Video[] {
  if (!userLocation) return [];
  
  return allVideos
    .filter(v => 
      !preferences.dislikedVideos.includes(v.id) &&
      v.location?.includes(userLocation.state)
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

function getHistoricalRecommendations(
  allVideos: Video[],
  preferences: UserPreferences,
  limit: number = 12
): Video[] {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  return allVideos
    .filter(v => 
      !preferences.dislikedVideos.includes(v.id) &&
      new Date(v.uploadDate) < twoYearsAgo
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

function getDiscoverNewBands(
  allVideos: Video[],
  preferences: UserPreferences,
  limit: number = 12
): Video[] {
  const watchedBands = new Set(
    allVideos
      .filter(v => preferences.watchedVideos.includes(v.id))
      .map(v => v.bandId)
  );
  
  return allVideos
    .filter(v => 
      !watchedBands.has(v.bandId) &&
      !preferences.dislikedVideos.includes(v.id)
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

// ============ Helper Functions ============

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

// ============ VideoCard Component ============

interface VideoCardProps {
  video: Video;
  onLike: (videoId: string) => void;
  onDislike: (videoId: string) => void;
  isLiked: boolean;
  isDisliked: boolean;
}

function VideoCard({ video, onLike, onDislike, isLiked, isDisliked }: VideoCardProps) {
  return (
    <div className="group flex-shrink-0 w-72">
      {/* Video Thumbnail */}
      <Link href={`/videos/${video.id}`}>
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-3 shadow-md hover:shadow-xl transition-shadow">
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover group-hover:opacity-90 transition-opacity"
          />
          
          {/* Duration Badge */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {formatDuration(video.duration)}
          </div>
          
          {/* Trending Badge */}
          {video.trendingScore && video.trendingScore > 80 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Trending
            </div>
          )}
        </div>
      </Link>
      
      {/* Video Info */}
      <div className="px-1">
        <Link href={`/videos/${video.id}`}>
          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
            {video.title}
          </h3>
        </Link>
        
        <Link href={`/bands/${video.bandId}`}>
          <p className="text-xs text-gray-600 hover:text-blue-600 transition-colors mb-1">
            {video.bandName}
          </p>
        </Link>
        
        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{formatViewCount(video.viewCount)}</span>
          </div>
          <span>•</span>
          <span>{formatRelativeTime(video.uploadDate)}</span>
        </div>
        
        {/* Event and Location */}
        {(video.eventName || video.location) && (
          <div className="flex flex-col gap-1 text-xs text-gray-500 mb-2">
            {video.eventName && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span className="truncate">{video.eventName}</span>
              </div>
            )}
            {video.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{video.location}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Like/Dislike Buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onLike(video.id);
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
              isLiked
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
            }`}
            title="I like this"
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
            {isLiked ? 'Liked' : 'Like'}
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              onDislike(video.id);
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
              isDisliked
                ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
            }`}
            title="Not interested"
          >
            <ThumbsDown className={`h-3.5 w-3.5 ${isDisliked ? 'fill-current' : ''}`} />
            {isDisliked ? 'Disliked' : 'Pass'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ RecommendationRow Component ============

interface RecommendationRowProps {
  section: RecommendationSection;
  onLike: (videoId: string) => void;
  onDislike: (videoId: string) => void;
  likedVideos: Set<string>;
  dislikedVideos: Set<string>;
}

function RecommendationRow({ section, onLike, onDislike, likedVideos, dislikedVideos }: RecommendationRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const displayVideos = isExpanded ? section.videos : section.videos.slice(0, 4);
  
  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-gray-700">
            {section.icon}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
          
          {/* Explanation Tooltip */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Explanation"
            >
              <Info className="h-4 w-4" />
            </button>
            
            {showTooltip && (
              <div className="absolute left-0 top-6 z-10 w-64 bg-gray-900 text-white text-sm p-3 rounded-lg shadow-xl">
                {section.explanation}
                <div className="absolute -top-2 left-4 w-3 h-3 bg-gray-900 transform rotate-45" />
              </div>
            )}
          </div>
        </div>
        
        {/* See More Button */}
        {section.videos.length > 4 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {isExpanded ? 'Show less' : `See more (${section.videos.length})`}
            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      
      {/* Videos Display */}
      {isExpanded ? (
        // Grid View
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              onLike={onLike}
              onDislike={onDislike}
              isLiked={likedVideos.has(video.id)}
              isDisliked={dislikedVideos.has(video.id)}
            />
          ))}
        </div>
      ) : (
        // Horizontal Scroll
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {displayVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onLike={onLike}
                onDislike={onDislike}
                isLiked={likedVideos.has(video.id)}
                isDisliked={dislikedVideos.has(video.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Main VideoRecommendations Component ============

export function VideoRecommendations({ userId, userLocation }: VideoRecommendationsProps) {
  const [loading, setLoading] = useState(true);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    watchedVideos: [],
    likedVideos: [],
    dislikedVideos: [],
    favoriteBands: [],
    preferredCategories: [],
  });
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  
  // Initialize mock data and user preferences
  useEffect(() => {
    // TODO: In production, fetch from API:
    // - GET /api/videos (video catalog)
    // - GET /api/users/${userId}/preferences (user preferences)
    
    const initializeData = async () => {
      setLoading(true);
      
      // Simulate API delay (for development only)
      // TODO: Remove this delay in production
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate mock videos
      const videos = generateMockVideos(100);
      setAllVideos(videos);
      
      // Initialize mock user preferences
      const mockPreferences: UserPreferences = {
        watchedVideos: videos.slice(0, 10).map(v => v.id),
        likedVideos: videos.slice(0, 5).map(v => v.id),
        dislikedVideos: [],
        favoriteBands: [HBCU_BANDS[0].id, HBCU_BANDS[1].id, HBCU_BANDS[2].id],
        preferredCategories: ['5th Quarter', 'Field Show'],
      };
      setPreferences(mockPreferences);
      
      setLoading(false);
    };
    
    initializeData();
  }, [userId]);
  
  // Generate recommendation sections
  useEffect(() => {
    if (allVideos.length === 0) return;
    
    const newSections: RecommendationSection[] = [];
    const currentMonth = new Date().getMonth();
    
    // Content-based recommendations
    const contentBased = getContentBasedRecommendations(allVideos, preferences);
    if (contentBased.length > 0) {
      const recentBand = allVideos.find(v => preferences.watchedVideos.includes(v.id))?.bandName;
      const title = recentBand 
        ? `Because you watched ${recentBand}`
        : 'More Like What You\'ve Watched';
      newSections.push({
        id: 'content-based',
        title,
        icon: <Sparkles className="h-6 w-6" />,
        videos: contentBased,
        explanation: 'Videos from bands and categories similar to what you\'ve watched recently',
        type: 'personalized',
      });
    }
    
    // Trending recommendations
    const trending = getTrendingRecommendations(allVideos, preferences);
    if (trending.length > 0) {
      newSections.push({
        id: 'trending',
        title: 'Trending Now',
        icon: <TrendingUp className="h-6 w-6" />,
        videos: trending,
        explanation: 'Most popular performances gaining views right now',
        type: 'trending',
      });
    }
    
    // Seasonal recommendations
    const seasonal = getSeasonalRecommendations(allVideos, preferences, currentMonth);
    if (seasonal && seasonal.videos.length > 0) {
      newSections.push({
        id: 'seasonal',
        title: seasonal.title,
        icon: <Calendar className="h-6 w-6" />,
        videos: seasonal.videos,
        explanation: seasonal.explanation,
        type: 'seasonal',
      });
    }
    
    // Discover new bands
    const discover = getDiscoverNewBands(allVideos, preferences);
    if (discover.length > 0) {
      newSections.push({
        id: 'discover',
        title: 'Discover New Bands',
        icon: <Users className="h-6 w-6" />,
        videos: discover,
        explanation: 'Explore performances from HBCU bands you haven\'t watched yet',
        type: 'discover',
      });
    }
    
    // Geographic recommendations
    if (userLocation) {
      const geographic = getGeographicRecommendations(allVideos, preferences, userLocation);
      if (geographic.length > 0) {
        newSections.push({
          id: 'geographic',
          title: 'Performances Near You',
          icon: <MapPin className="h-6 w-6" />,
          videos: geographic,
          explanation: `Bands and performances from your area (${userLocation.state})`,
          type: 'geographic',
        });
      }
    }
    
    // Collaborative filtering
    const collaborative = getCollaborativeRecommendations(allVideos, preferences);
    if (collaborative.length > 0) {
      newSections.push({
        id: 'collaborative',
        title: 'Based on Your Favorites',
        icon: <Star className="h-6 w-6" />,
        videos: collaborative,
        explanation: 'More from your favorite bands and similar preferences',
        type: 'personalized',
      });
    }
    
    // Historical performances
    const historical = getHistoricalRecommendations(allVideos, preferences);
    if (historical.length > 0) {
      newSections.push({
        id: 'historical',
        title: 'Classic Performances',
        icon: <History className="h-6 w-6" />,
        videos: historical,
        explanation: 'Legendary performances and most-viewed legacy content',
        type: 'historical',
      });
    }
    
    setSections(newSections);
  }, [allVideos, preferences, userLocation]);
  
  // Handle like action
  const handleLike = (videoId: string) => {
    // TODO: In production, call API: POST /api/users/${userId}/preferences/like
    
    setPreferences(prev => {
      const newLiked = new Set(prev.likedVideos);
      const newDisliked = new Set(prev.dislikedVideos);
      
      if (newLiked.has(videoId)) {
        // Unlike
        newLiked.delete(videoId);
      } else {
        // Like (and remove from disliked if present)
        newLiked.add(videoId);
        newDisliked.delete(videoId);
      }
      
      return {
        ...prev,
        likedVideos: Array.from(newLiked),
        dislikedVideos: Array.from(newDisliked),
      };
    });
  };
  
  // Handle dislike action
  const handleDislike = (videoId: string) => {
    // TODO: In production, call API: POST /api/users/${userId}/preferences/dislike
    
    setPreferences(prev => {
      const newLiked = new Set(prev.likedVideos);
      const newDisliked = new Set(prev.dislikedVideos);
      
      if (newDisliked.has(videoId)) {
        // Undislike
        newDisliked.delete(videoId);
      } else {
        // Dislike (and remove from liked if present)
        newDisliked.add(videoId);
        newLiked.delete(videoId);
      }
      
      return {
        ...prev,
        likedVideos: Array.from(newLiked),
        dislikedVideos: Array.from(newDisliked),
      };
    });
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading recommendations...</p>
        </div>
      </div>
    );
  }
  
  // Empty state
  if (sections.length === 0) {
    return (
      <div className="text-center py-20">
        <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recommendations Yet</h3>
        <p className="text-gray-600">Start watching videos to get personalized recommendations!</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Recommended for You</h1>
        <p className="text-gray-600">Personalized video recommendations based on your preferences and viewing history</p>
      </div>
      
      {/* Recommendation Sections */}
      {sections.map(section => (
        <RecommendationRow
          key={section.id}
          section={section}
          onLike={handleLike}
          onDislike={handleDislike}
          likedVideos={new Set(preferences.likedVideos)}
          dislikedVideos={new Set(preferences.dislikedVideos)}
        />
      ))}
    </div>
  );
}
