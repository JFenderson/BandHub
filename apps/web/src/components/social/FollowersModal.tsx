'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, X, UserPlus, Check } from 'lucide-react';
import { useFollowing } from '@/hooks/useFollowing';
import type { FollowUser } from '@/lib/api/following';

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function FollowersModal({ isOpen, onClose, userId }: FollowersModalProps) {
  const { getFollowers, followUser, checkFollowStatus, isLoading } = useFollowing();
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({});
  const [followingInProgress, setFollowingInProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && userId) {
      loadFollowers();
    }
  }, [isOpen, userId, currentPage]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = followers.filter(
        (user) =>
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFollowers(filtered);
    } else {
      setFilteredFollowers(followers);
    }
  }, [searchQuery, followers]);

  const loadFollowers = async () => {
    try {
      const response = await getFollowers(userId, currentPage, 20);
      setFollowers(response.data);
      setFilteredFollowers(response.data);
      setTotalPages(response.meta.totalPages);

      const statusMap: Record<string, boolean> = {};
      for (const follower of response.data) {
        statusMap[follower.id] = await checkFollowStatus(follower.id);
      }
      setFollowingStatus(statusMap);
    } catch (error) {
      console.error('Failed to load followers:', error);
    }
  };

  const handleFollowBack = async (followerId: string) => {
    if (followingInProgress[followerId]) return;

    setFollowingInProgress({ ...followingInProgress, [followerId]: true });
    try {
      await followUser(followerId);
      setFollowingStatus({ ...followingStatus, [followerId]: true });
    } catch (error) {
      console.error('Failed to follow user:', error);
    } finally {
      setFollowingInProgress({ ...followingInProgress, [followerId]: false });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Followers
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search followers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Followers List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && followers.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredFollowers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No followers found matching your search' : 'No followers yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFollowers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <Link
                    href={`/profile/${follower.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {/* Avatar */}
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                      {follower.avatar ? (
                        <Image
                          src={follower.avatar}
                          alt={follower.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold">
                          {follower.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {follower.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {follower.email}
                      </p>
                      {follower.bio && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                          {follower.bio}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Follow Back Button */}
                  {!followingStatus[follower.id] ? (
                    <button
                      onClick={() => handleFollowBack(follower.id)}
                      disabled={followingInProgress[follower.id]}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {followingInProgress[follower.id] ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Follow Back
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4" />
                      Following
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
