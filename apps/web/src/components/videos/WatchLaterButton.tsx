'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { favoritesApiClient } from '@/lib/api/favorites';
import { getAuthTokens } from '@/lib/utils/cookies';

interface WatchLaterButtonProps {
  videoId: string;
  initialInWatchLater?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onToggle?: (inWatchLater: boolean) => void;
}

export function WatchLaterButton({
  videoId,
  initialInWatchLater = false,
  size = 'md',
  showLabel = false,
  className = '',
  onToggle,
}: WatchLaterButtonProps) {
  const { isAuthenticated } = useUser();
  const [isInWatchLater, setIsInWatchLater] = useState(initialInWatchLater);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Set up token provider for the API client
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  // Fetch initial status if authenticated
  useEffect(() => {
    if (isAuthenticated && !initialInWatchLater) {
      favoritesApiClient.isInWatchLater(videoId)
        .then(({ isInWatchLater }) => setIsInWatchLater(isInWatchLater))
        .catch(() => {});
    }
  }, [isAuthenticated, videoId, initialInWatchLater]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowToast({ type: 'error', message: 'Please log in to save videos' });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // Optimistic update
    const newState = !isInWatchLater;
    setIsInWatchLater(newState);
    setIsLoading(true);

    try {
      if (newState) {
        await favoritesApiClient.addToWatchLater(videoId);
        setShowToast({ type: 'success', message: 'Added to watch later' });
      } else {
        await favoritesApiClient.removeFromWatchLater(videoId);
        setShowToast({ type: 'success', message: 'Removed from watch later' });
      }
      onToggle?.(newState);
    } catch (error) {
      // Revert on error
      setIsInWatchLater(!newState);
      setShowToast({ type: 'error', message: 'Failed to update watch later' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [isAuthenticated, isInWatchLater, videoId, onToggle]);

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
          ${isInWatchLater 
            ? 'text-primary-500 hover:text-primary-600' 
            : 'text-gray-400 hover:text-primary-500'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          ${className}
        `}
        aria-label={isInWatchLater ? 'Remove from watch later' : 'Add to watch later'}
        aria-pressed={isInWatchLater}
        title={isInWatchLater ? 'Remove from watch later' : 'Watch later'}
      >
        <svg
          className={`${sizeClasses[size]} ${isLoading ? 'animate-pulse' : ''}`}
          fill={isInWatchLater ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        {showLabel && (
          <span className="ml-1 text-sm">
            {isInWatchLater ? 'Saved' : 'Watch Later'}
          </span>
        )}
      </button>

      {/* Toast notification */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={showToast ? '' : 'sr-only'}
      >
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
    </div>
  );
}
