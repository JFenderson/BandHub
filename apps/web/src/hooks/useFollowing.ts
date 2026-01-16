'use client';

import { useState, useCallback, useEffect } from 'react';
import { followingApiClient } from '@/lib/api/following';
import { getAuthTokens } from '@/lib/utils/cookies';
import type { FollowCounts, PaginatedFollowResponse } from '@/lib/api/following';

export function useFollowing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up token provider for the API client
  useEffect(() => {
    followingApiClient.setTokenProvider(getAuthTokens);
  }, []);

  const followUser = useCallback(async (userId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await followingApiClient.followUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to follow user';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unfollowUser = useCallback(async (userId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await followingApiClient.unfollowUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unfollow user';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkFollowStatus = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await followingApiClient.isFollowing(userId);
      return result.isFollowing;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check follow status';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFollowers = useCallback(async (
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedFollowResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      return await followingApiClient.getFollowers(userId, { page, limit });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get followers';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFollowing = useCallback(async (
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedFollowResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      return await followingApiClient.getFollowing(userId, { page, limit });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get following';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFollowCounts = useCallback(async (userId: string): Promise<FollowCounts> => {
    setIsLoading(true);
    setError(null);
    try {
      return await followingApiClient.getFollowCounts(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get follow counts';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    followUser,
    unfollowUser,
    checkFollowStatus,
    getFollowers,
    getFollowing,
    getFollowCounts,
    isLoading,
    error,
  };
}
