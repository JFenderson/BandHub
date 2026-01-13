/**
 * CommentThread component - Handles nested comment replies
 */
'use client';

import React, { useState } from 'react';
import type { Comment, ReactionGroup } from '../../types/comments';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

interface CommentThreadProps {
  comment: Comment;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isAdmin?: boolean;
  videoId: string;
  videoCurrentTime?: number;
  maxDepth?: number;
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
  depth?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin = false,
  videoId,
  videoCurrentTime,
  maxDepth = 5,
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
  depth = 0,
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const handleReply = (commentId: string) => {
    setShowReplyForm(true);
  };

  const handleSubmitReply = (content: string, timestamp?: number) => {
    onSubmitReply(comment.id, content, timestamp);
    setShowReplyForm(false);
  };

  const canNest = depth < maxDepth;
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className="space-y-4">
      {/* Main comment */}
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onReply={handleReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        onReact={onReact}
        onRemoveReaction={onRemoveReaction}
        onReport={onReport}
        onPin={onPin}
        reactions={getReactions(comment.id)}
        depth={depth}
      />

      {/* Reply form */}
      {showReplyForm && canNest && (
        <div className="ml-16 mt-2">
          <CommentForm
            videoId={videoId}
            parentCommentId={comment.id}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            onSubmit={handleSubmitReply}
            onCancel={() => setShowReplyForm(false)}
            placeholder={`Reply to ${comment.userName}...`}
            videoCurrentTime={videoCurrentTime}
          />
        </div>
      )}

      {/* Nested replies */}
      {hasReplies && canNest && (
        <div className="ml-8 space-y-4">
          {/* Toggle button for replies */}
          {comment.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showReplies ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {showReplies ? 'Hide' : 'Show'} {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {/* Render replies */}
          {showReplies && comment.replies?.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
              isAdmin={isAdmin}
              videoId={videoId}
              videoCurrentTime={videoCurrentTime}
              maxDepth={maxDepth}
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
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {/* Max depth reached message */}
      {!canNest && comment.replyCount > 0 && (
        <div className="ml-16 text-sm text-gray-500 italic">
          Maximum reply depth reached. View thread to see more replies.
        </div>
      )}
    </div>
  );
};
