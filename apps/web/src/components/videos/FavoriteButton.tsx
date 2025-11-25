'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { favoritesApiClient } from '@/lib/api/favorites';
import { getAuthTokens } from '@/lib/utils/cookies';

interface FavoriteButtonProps {
  videoId: string;
  initialFavorited?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onToggle?: (favorited: boolean) => void;
}

export function FavoriteButton({
  videoId,
  initialFavorited = false,
  size = 'md',
  showLabel = false,
  className = '',
  onToggle,
}: FavoriteButtonProps) {
  const { isAuthenticated, user } = useUser();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Set up token provider for the API client
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  // Fetch initial status if authenticated
  useEffect(() => {
    if (isAuthenticated && !initialFavorited) {
      favoritesApiClient.isVideoFavorited(videoId)
        .then(({ isFavorited }) => setIsFavorited(isFavorited))
        .catch(() => {});
    }
  }, [isAuthenticated, videoId, initialFavorited]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowToast({ type: 'error', message: 'Please log in to save favorites' });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // Optimistic update
    const newState = !isFavorited;
    setIsFavorited(newState);
    setIsLoading(true);

    try {
      if (newState) {
        await favoritesApiClient.addFavoriteVideo(videoId);
        setShowToast({ type: 'success', message: 'Added to favorites' });
      } else {
        await favoritesApiClient.removeFavoriteVideo(videoId);
        setShowToast({ type: 'success', message: 'Removed from favorites' });
      }
      onToggle?.(newState);
    } catch (error) {
      // Revert on error
      setIsFavorited(!newState);
      setShowToast({ type: 'error', message: 'Failed to update favorites' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [isAuthenticated, isFavorited, videoId, onToggle]);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          ${buttonSizeClasses[size]}
          rounded-full transition-all duration-200
          ${isFavorited 
            ? 'text-red-500 hover:text-red-600' 
            : 'text-gray-400 hover:text-red-500'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
          ${className}
        `}
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg
          className={`${sizeClasses[size]} ${isLoading ? 'animate-pulse' : ''}`}
          fill={isFavorited ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {showLabel && (
          <span className="ml-1 text-sm">
            {isFavorited ? 'Favorited' : 'Favorite'}
          </span>
        )}
      </button>

      {/* Toast notification */}
      {showToast && (
        <div
          className={`
            absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
            px-3 py-1 rounded-lg text-sm whitespace-nowrap
            ${showToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
            shadow-lg z-50 animate-fade-in
          `}
        >
          {showToast.message}
        </div>
      )}
    </div>
  );
}
