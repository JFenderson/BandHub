/**
 * CommentList component - Displays list of comments with sorting options
 */
'use client';

import React, { useState, useMemo } from 'react';
import type { Comment, SortOption, ReactionGroup } from '../../types/comments';
import { CommentThread } from './CommentThread';

interface CommentListProps {
  comments: Comment[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isAdmin?: boolean;
  videoId: string;
  videoCurrentTime?: number;
  onSubmitReply: (parentId: string, content: string, timestamp?: number) => void;
  onEdit: (commentId: string, newContent: string) => void;
  onDelete: (commentId: string) => void;
  onUpvote: (commentId: string) => void;
  onDownvote: (commentId: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
  onReport: (commentId: string) => void;
  onPin?: (commentId: string) => void;
  getReactions: (commentId: string) => ReactionGroup[];
}

export const CommentList: React.FC<CommentListProps> = ({
  comments,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin = false,
  videoId,
  videoCurrentTime,
  onSubmitReply,
  onEdit,
  onDelete,
  onUpvote,
  onDownvote,
  onReact,
  onRemoveReaction,
  onReport,
  onPin,
  getReactions,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Sort comments based on selected option
  const sortedComments = useMemo(() => {
    const sorted = [...comments];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      
      case 'oldest':
        return sorted.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      
      case 'mostLiked':
        return sorted.sort((a, b) => {
          const aScore = a.upvotes - a.downvotes;
          const bScore = b.upvotes - b.downvotes;
          return bScore - aScore;
        });
      
      case 'controversial':
        return sorted.sort((a, b) => {
          // Comments with similar upvotes and downvotes are controversial
          const aControversy = Math.min(a.upvotes, a.downvotes);
          const bControversy = Math.min(b.upvotes, b.downvotes);
          return bControversy - aControversy;
        });
      
      case 'timestamp':
        return sorted.sort((a, b) => {
          // Comments without timestamp go to the end
          if (a.timestamp === undefined) return 1;
          if (b.timestamp === undefined) return -1;
          return a.timestamp - b.timestamp;
        });
      
      default:
        return sorted;
    }
  }, [comments, sortBy]);

  // Separate pinned comments
  const pinnedComments = sortedComments.filter(c => c.isPinned);
  const regularComments = sortedComments.filter(c => !c.isPinned);

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No comments yet. Be the first to comment!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-comments" className="text-sm text-gray-600 dark:text-gray-400">
            Sort by:
          </label>
          <select
            id="sort-comments"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="mostLiked">Most Liked</option>
            <option value="controversial">Controversial</option>
            <option value="timestamp">Timestamp</option>
          </select>
        </div>
      </div>

      {/* Pinned comments */}
      {pinnedComments.length > 0 && (
        <div className="space-y-4">
          {pinnedComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
              isAdmin={isAdmin}
              videoId={videoId}
              videoCurrentTime={videoCurrentTime}
              onSubmitReply={onSubmitReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpvote={onUpvote}
              onDownvote={onDownvote}
              onReact={onReact}
              onRemoveReaction={onRemoveReaction}
              onReport={onReport}
              onPin={onPin}
              getReactions={getReactions}
            />
          ))}
          {regularComments.length > 0 && (
            <div className="border-t border-gray-300 dark:border-gray-600" />
          )}
        </div>
      )}

      {/* Regular comments */}
      <div className="space-y-4">
        {regularComments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            isAdmin={isAdmin}
            videoId={videoId}
            videoCurrentTime={videoCurrentTime}
            onSubmitReply={onSubmitReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpvote={onUpvote}
            onDownvote={onDownvote}
            onReact={onReact}
            onRemoveReaction={onRemoveReaction}
            onReport={onReport}
            onPin={onPin}
            getReactions={getReactions}
          />
        ))}
      </div>
    </div>
  );
};
