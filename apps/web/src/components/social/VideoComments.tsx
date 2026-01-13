/**
 * VideoComments component - Main container for video comment system
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Comment, Reaction, CommentReport, ReactionGroup } from '../../types/comments';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';
import { CommentReport as CommentReportModal } from './CommentReport';

interface VideoCommentsProps {
  videoId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isAdmin?: boolean;
  videoCurrentTime?: number;
}

export const VideoComments: React.FC<VideoCommentsProps> = ({
  videoId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin = false,
  videoCurrentTime,
}) => {
  // State management
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reports, setReports] = useState<CommentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);

  // Fetch comments from API
  // TODO: Replace mock implementation with actual API integration
  // See README.md for required API endpoints
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        
        // Example API integration:
        // const response = await fetch(`/api/videos/${videoId}/comments`);
        // if (!response.ok) throw new Error('Failed to fetch');
        // const data = await response.json();
        // setComments(data.comments);
        // setReactions(data.reactions);
        
        // Mock: Start with empty comments for demo
        setComments([]);
        setLoading(false);
      } catch (err) {
        setError('Failed to load comments');
        setLoading(false);
      }
    };

    fetchComments();
  }, [videoId]);

  // Build nested comment structure
  const buildCommentTree = useCallback((flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create a map of all comments
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build the tree structure
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  }, []);

  // Get reactions for a specific comment
  const getReactions = useCallback((commentId: string): ReactionGroup[] => {
    const commentReactions = reactions.filter(r => r.commentId === commentId);
    const reactionMap = new Map<string, ReactionGroup>();

    commentReactions.forEach(reaction => {
      const existing = reactionMap.get(reaction.emoji);
      if (existing) {
        existing.count++;
        existing.users.push({ id: reaction.userId, name: reaction.userName });
        if (reaction.userId === currentUserId) {
          existing.userReacted = true;
        }
      } else {
        reactionMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [{ id: reaction.userId, name: reaction.userName }],
          userReacted: reaction.userId === currentUserId,
        });
      }
    });

    return Array.from(reactionMap.values());
  }, [reactions, currentUserId]);

  // Handle new comment submission
  const handleSubmitComment = async (content: string, timestamp?: number) => {
    try {
      // Example API integration:
      // const response = await fetch(`/api/videos/${videoId}/comments`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ content, timestamp }),
      // });
      // if (!response.ok) throw new Error('Failed to post');
      // const newComment = await response.json();
      // setComments(prev => [...prev, newComment]);

      // Mock: Create comment locally for demo
      const newComment: Comment = {
        id: Date.now().toString(),
        videoId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar || null,
        content,
        timestamp,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isPinned: false,
        isApproved: true,
        isFlagged: false,
        upvotes: 0,
        downvotes: 0,
        replyCount: 0,
      };

      setComments(prev => [...prev, newComment]);
    } catch (err) {
      setError('Failed to post comment');
    }
  };

  // Handle reply submission
  const handleSubmitReply = async (parentId: string, content: string, timestamp?: number) => {
    try {
      const newComment: Comment = {
        id: Date.now().toString(),
        videoId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar || null,
        content,
        parentCommentId: parentId,
        timestamp,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isPinned: false,
        isApproved: true,
        isFlagged: false,
        upvotes: 0,
        downvotes: 0,
        replyCount: 0,
      };

      setComments(prev => {
        // Update reply count for parent
        const updated = prev.map(c => 
          c.id === parentId 
            ? { ...c, replyCount: c.replyCount + 1 }
            : c
        );
        return [...updated, newComment];
      });
    } catch (err) {
      setError('Failed to post reply');
    }
  };

  // Handle comment edit
  const handleEdit = async (commentId: string, newContent: string) => {
    try {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, content: newContent, editedAt: new Date() }
            : c
        )
      );
    } catch (err) {
      setError('Failed to edit comment');
    }
  };

  // Handle comment delete
  const handleDelete = async (commentId: string) => {
    try {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, isDeleted: true }
            : c
        )
      );
    } catch (err) {
      setError('Failed to delete comment');
    }
  };

  // Handle upvote
  const handleUpvote = async (commentId: string) => {
    try {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, upvotes: c.upvotes + 1 }
            : c
        )
      );
    } catch (err) {
      setError('Failed to upvote');
    }
  };

  // Handle downvote
  const handleDownvote = async (commentId: string) => {
    try {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, downvotes: c.downvotes + 1 }
            : c
        )
      );
    } catch (err) {
      setError('Failed to downvote');
    }
  };

  // Handle reaction
  const handleReact = async (commentId: string, emoji: string) => {
    try {
      const newReaction: Reaction = {
        id: Date.now().toString(),
        commentId,
        userId: currentUserId,
        userName: currentUserName,
        emoji,
        createdAt: new Date(),
      };

      setReactions(prev => [...prev, newReaction]);
    } catch (err) {
      setError('Failed to add reaction');
    }
  };

  // Handle remove reaction
  const handleRemoveReaction = async (commentId: string, emoji: string) => {
    try {
      setReactions(prev =>
        prev.filter(
          r => !(r.commentId === commentId && r.emoji === emoji && r.userId === currentUserId)
        )
      );
    } catch (err) {
      setError('Failed to remove reaction');
    }
  };

  // Handle report
  const handleReport = (commentId: string) => {
    setReportingCommentId(commentId);
  };

  // Handle submit report
  const handleSubmitReport = async (category: string, description?: string) => {
    if (!reportingCommentId) return;

    try {
      const newReport: CommentReport = {
        id: Date.now().toString(),
        commentId: reportingCommentId,
        reporterId: currentUserId,
        category: category as any,
        description,
        status: 'pending',
        createdAt: new Date(),
      };

      setReports(prev => [...prev, newReport]);
      setReportingCommentId(null);
    } catch (err) {
      setError('Failed to submit report');
    }
  };

  // Handle pin/unpin
  const handlePin = async (commentId: string) => {
    try {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, isPinned: !c.isPinned }
            : c
        )
      );
    } catch (err) {
      setError('Failed to pin comment');
    }
  };

  const commentTree = buildCommentTree(comments);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Comments
      </h2>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Comment form */}
      <div className="mb-8">
        <CommentForm
          videoId={videoId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          onSubmit={handleSubmitComment}
          videoCurrentTime={videoCurrentTime}
        />
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-500" />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading comments...</p>
        </div>
      ) : (
        <CommentList
          comments={commentTree}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isAdmin={isAdmin}
          videoId={videoId}
          videoCurrentTime={videoCurrentTime}
          onSubmitReply={handleSubmitReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpvote={handleUpvote}
          onDownvote={handleDownvote}
          onReact={handleReact}
          onRemoveReaction={handleRemoveReaction}
          onReport={handleReport}
          onPin={isAdmin ? handlePin : undefined}
          getReactions={getReactions}
        />
      )}

      {/* Report modal */}
      {reportingCommentId && (
        <CommentReportModal
          commentId={reportingCommentId}
          onSubmit={handleSubmitReport}
          onCancel={() => setReportingCommentId(null)}
        />
      )}
    </div>
  );
};
