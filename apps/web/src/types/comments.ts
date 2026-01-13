/**
 * TypeScript types for the video comments and reactions system
 */

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  parentCommentId?: string;
  timestamp?: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  isDeleted: boolean;
  isPinned: boolean;
  isApproved: boolean;
  isFlagged: boolean;
  upvotes: number;
  downvotes: number;
  replyCount: number;
  replies?: Comment[];
}

export interface Reaction {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  emoji: string;
  createdAt: Date;
}

export interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  category: 'spam' | 'harassment' | 'inappropriate' | 'off-topic' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}

export interface ModerationAction {
  id: string;
  commentId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'delete' | 'pin' | 'lock';
  reason?: string;
  createdAt: Date;
}

export type SortOption = 'newest' | 'oldest' | 'mostLiked' | 'controversial' | 'timestamp';

export interface CommentFilters {
  sortBy: SortOption;
  showDeleted?: boolean;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: Array<{ id: string; name: string }>;
  userReacted: boolean;
}
