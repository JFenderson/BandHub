/**
 * CommentItem component - Individual comment display with voting and reactions
 */
'use client';

import React, { useState } from 'react';
import type { Comment, ReactionGroup } from '../../types/comments';
import { ReactionPicker } from './ReactionPicker';
import { ReactionDisplay } from './ReactionDisplay';
import { formatTimestamp } from '../../utils/sanitize';

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  isAdmin?: boolean;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, newContent: string) => void;
  onDelete: (commentId: string) => void;
  onUpvote: (commentId: string) => void;
  onDownvote: (commentId: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
  onReport: (commentId: string) => void;
  onPin?: (commentId: string) => void;
  reactions?: ReactionGroup[];
  depth?: number;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  isAdmin = false,
  onReply,
  onEdit,
  onDelete,
  onUpvote,
  onDownvote,
  onReact,
  onRemoveReaction,
  onReport,
  onPin,
  reactions = [],
  depth = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isOwnComment = comment.userId === currentUserId;
  const voteScore = comment.upvotes - comment.downvotes;

  const handleEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.id, editContent);
      setIsEditing(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (comment.isDeleted) {
    return (
      <div className="text-gray-400 italic py-2">
        [This comment has been deleted]
      </div>
    );
  }

  return (
    <div className="group relative" style={{ paddingLeft: depth > 0 ? `${depth * 2}rem` : 0 }}>
      {comment.isPinned && (
        <div className="flex items-center gap-1 text-xs text-blue-500 mb-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1h-2z" />
          </svg>
          Pinned
        </div>
      )}

      <div className="flex gap-3">
        {/* Voting controls */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onUpvote(comment.id)}
            className="text-gray-400 hover:text-blue-500 transition-colors"
            aria-label="Upvote"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <span className={`text-sm font-bold ${voteScore > 0 ? 'text-blue-500' : voteScore < 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {voteScore}
          </span>
          <button
            onClick={() => onDownvote(comment.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Downvote"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Comment content */}
        <div className="flex-1 min-w-0">
          {/* User info */}
          <div className="flex items-center gap-2 mb-1">
            {comment.userAvatar ? (
              <img
                src={comment.userAvatar}
                alt={comment.userName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {comment.userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {comment.userName}
            </span>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-500">
              {formatDate(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500 italic">edited</span>
              </>
            )}
            {comment.timestamp !== undefined && (
              <>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-blue-500">
                  {formatTimestamp(comment.timestamp)}
                </span>
              </>
            )}
          </div>

          {/* Comment text */}
          {isEditing ? (
            <div className="mb-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-2">
              {comment.content}
            </p>
          )}

          {/* Reactions */}
          <ReactionDisplay
            reactions={reactions}
            onReact={(emoji) => onReact(comment.id, emoji)}
            onRemoveReaction={(emoji) => onRemoveReaction(comment.id, emoji)}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-4 mt-2">
            <div className="relative">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                React
              </button>
              <ReactionPicker
                isOpen={showReactionPicker}
                onSelect={(emoji) => onReact(comment.id, emoji)}
                onClose={() => setShowReactionPicker(false)}
              />
            </div>
            <button
              onClick={() => onReply(comment.id)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Reply {comment.replyCount > 0 && `(${comment.replyCount})`}
            </button>
            {isOwnComment && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Edit
              </button>
            )}
            {(isOwnComment || isAdmin) && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-500"
              >
                Delete
              </button>
            )}
            {!isOwnComment && (
              <button
                onClick={() => onReport(comment.id)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Report
              </button>
            )}
            {isAdmin && onPin && (
              <button
                onClick={() => onPin(comment.id)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500"
              >
                {comment.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
