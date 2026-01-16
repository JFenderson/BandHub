'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useFollowing } from '@/hooks/useFollowing';
import { useUser } from '@/contexts/UserContext';

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  size = 'md',
  className = '',
}: FollowButtonProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useUser();
  const { followUser, unfollowUser, checkFollowStatus, isLoading } = useFollowing();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check follow status on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      checkFollowStatus(userId).then((status) => {
        setIsFollowing(status);
      });
    }
  }, [isAuthenticated, user, authLoading, userId, checkFollowStatus]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleFollowToggle = async () => {
    if (!user) {
      setToast({
        type: 'error',
        message: 'Please sign in to follow users',
      });
      return;
    }

    if (user.id === userId) {
      setToast({
        type: 'error',
        message: "You can't follow yourself",
      });
      return;
    }

    // Optimistic update
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setToast({
          type: 'success',
          message: 'Unfollowed successfully',
        });
      } else {
        await followUser(userId);
        setToast({
          type: 'success',
          message: 'Following successfully',
        });
      }
      onFollowChange?.(!isFollowing);
    } catch (error) {
      // Revert on error
      setIsFollowing(previousState);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update follow status',
      });
    }
  };

  if (authLoading) {
    return null;
  }

  if (!user || user.id === userId) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <>
      <button
        onClick={handleFollowToggle}
        disabled={isLoading}
        className={`
          ${sizeClasses[size]}
          rounded-lg font-medium
          transition-all
          flex items-center gap-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isFollowing
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }
          ${className}
        `}
        aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
        aria-pressed={isFollowing}
        type="button"
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} aria-hidden="true" />
        ) : isFollowing ? (
          <>
            <UserMinus className={iconSizes[size]} aria-hidden="true" />
            Following
          </>
        ) : (
          <>
            <UserPlus className={iconSizes[size]} aria-hidden="true" />
            Follow
          </>
        )}
      </button>

      {/* Toast notification */}
      {toast && (
        <div
          className={`
            fixed bottom-4 right-4 z-50
            px-4 py-3 rounded-lg shadow-lg
            flex items-center gap-2
            animate-in slide-in-from-bottom-5
            ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }
          `}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
