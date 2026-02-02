'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { favoritesApiClient } from '@/lib/api/favorites';
import { getAuthTokens } from '@/lib/utils/cookies';

interface FollowButtonProps {
  bandId: string;
  initialFollowed?: boolean;
  initialFollowerCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showFollowerCount?: boolean;
  showNotificationToggle?: boolean;
  className?: string;
  onToggle?: (followed: boolean) => void;
}

export function FollowButton({
  bandId,
  initialFollowed = false,
  initialFollowerCount = 0,
  size = 'md',
  showFollowerCount = false,
  showNotificationToggle = false,
  className = '',
  onToggle,
}: FollowButtonProps) {
  const { isAuthenticated } = useUser();
  const [isFollowed, setIsFollowed] = useState(initialFollowed);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfirmUnfollow, setShowConfirmUnfollow] = useState(false);

  // Set up token provider for the API client
  useEffect(() => {
    favoritesApiClient.setTokenProvider(getAuthTokens);
  }, []);

  // Fetch initial status if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      favoritesApiClient.getBandStatus(bandId)
        .then(({ isFollowed, followerCount }) => {
          setIsFollowed(isFollowed);
          setFollowerCount(followerCount);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, bandId]);

  const handleFollow = useCallback(async () => {
    if (!isAuthenticated) {
      setShowToast({ type: 'error', message: 'Please log in to follow bands' });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // Optimistic update
    setIsFollowed(true);
    setFollowerCount(prev => prev + 1);
    setIsLoading(true);

    try {
      await favoritesApiClient.followBand(bandId);
      setShowToast({ type: 'success', message: 'Now following this band!' });
      onToggle?.(true);
    } catch (error) {
      // Revert on error
      setIsFollowed(false);
      setFollowerCount(prev => prev - 1);
      setShowToast({ type: 'error', message: 'Failed to follow band' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [isAuthenticated, bandId, onToggle]);

  const handleUnfollow = useCallback(async () => {
    setShowConfirmUnfollow(false);
    
    // Optimistic update
    setIsFollowed(false);
    setFollowerCount(prev => Math.max(0, prev - 1));
    setIsLoading(true);

    try {
      await favoritesApiClient.unfollowBand(bandId);
      setShowToast({ type: 'success', message: 'Unfollowed band' });
      onToggle?.(false);
    } catch (error) {
      // Revert on error
      setIsFollowed(true);
      setFollowerCount(prev => prev + 1);
      setShowToast({ type: 'error', message: 'Failed to unfollow band' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [bandId, onToggle]);

  const handleToggleNotifications = useCallback(async () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);

    try {
      await favoritesApiClient.updateBandNotifications(bandId, newState);
      setShowToast({ 
        type: 'success', 
        message: newState ? 'Notifications enabled' : 'Notifications disabled' 
      });
    } catch (error) {
      setNotificationsEnabled(!newState);
      setShowToast({ type: 'error', message: 'Failed to update notifications' });
    } finally {
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [bandId, notificationsEnabled]);

  const handleClick = () => {
    if (isFollowed) {
      setShowConfirmUnfollow(true);
    } else {
      handleFollow();
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <div className="relative">
      <div className={`flex items-center space-x-2 ${className}`}>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={`
            ${sizeClasses[size]}
            rounded-full font-medium transition-all duration-200
            ${isFollowed 
              ? 'bg-gray-200 text-gray-700 hover:bg-red-100 hover:text-red-600' 
              : 'bg-primary-600 text-white hover:bg-primary-700'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          `}
          aria-label={isFollowed ? 'Unfollow' : 'Follow'}
          aria-pressed={isFollowed}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
          ) : isFollowed ? (
            'Following'
          ) : (
            'Follow'
          )}
        </button>

        {showFollowerCount && (
          <span className="text-sm text-gray-500">
            {followerCount.toLocaleString()} {followerCount === 1 ? 'follower' : 'followers'}
          </span>
        )}

        {isFollowed && showNotificationToggle && (
          <button
            onClick={handleToggleNotifications}
            className={`
              p-2 rounded-full transition-all duration-200
              ${notificationsEnabled 
                ? 'text-primary-500 hover:text-primary-600 bg-primary-50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }
            `}
            title={notificationsEnabled ? 'Turn off notifications' : 'Turn on notifications'}
            aria-label={notificationsEnabled ? 'Turn off notifications' : 'Turn on notifications'}
            aria-pressed={notificationsEnabled}
          >
            <svg className="w-5 h-5" fill={notificationsEnabled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        )}
      </div>

      {/* Confirm Unfollow Dialog */}
      {showConfirmUnfollow && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unfollow-dialog-title"
          aria-describedby="unfollow-dialog-description"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 id="unfollow-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">Unfollow Band?</h3>
            <p id="unfollow-dialog-description" className="text-gray-600 mb-4">
              You will no longer receive notifications about new videos from this band.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmUnfollow(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnfollow}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Unfollow
              </button>
            </div>
          </div>
        </div>
      )}

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
              absolute top-full left-1/2 transform -translate-x-1/2 mt-2
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
