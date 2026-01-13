/**
 * CommentForm component - Form for submitting new comments
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { containsProfanity, isSpam } from '../../utils/sanitize';

interface CommentFormProps {
  videoId: string;
  parentCommentId?: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onSubmit: (content: string, timestamp?: number) => void;
  onCancel?: () => void;
  placeholder?: string;
  maxLength?: number;
  videoCurrentTime?: number;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  videoId,
  parentCommentId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment...',
  maxLength = 1000,
  videoCurrentTime,
}) => {
  const [content, setContent] = useState('');
  const [attachTimestamp, setAttachTimestamp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setError('Comment cannot be empty');
      return;
    }

    if (trimmedContent.length > maxLength) {
      setError(`Comment must be ${maxLength} characters or less`);
      return;
    }

    if (containsProfanity(trimmedContent)) {
      setError('Comment contains inappropriate language');
      return;
    }

    if (isSpam(trimmedContent)) {
      setError('Comment appears to be spam');
      return;
    }

    const timestamp = attachTimestamp && videoCurrentTime !== undefined 
      ? videoCurrentTime 
      : undefined;

    // IMPORTANT: Content should be sanitized server-side before storing in database
    // This prevents XSS attacks from persisted data
    // Client-side sanitization is only a first line of defense
    // Example server-side sanitization:
    //   const sanitized = DOMPurify.sanitize(content);
    //   await db.comments.create({ content: sanitized, ... });
    onSubmit(trimmedContent, timestamp);
    setContent('');
    setAttachTimestamp(false);
  };

  const remainingChars = maxLength - content.length;
  const isNearLimit = remainingChars < 50;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-3">
        {/* User avatar */}
        <div className="flex-shrink-0">
          {currentUserAvatar ? (
            <img
              src={currentUserAvatar}
              alt={currentUserName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {currentUserName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={1}
            maxLength={maxLength}
            aria-label="Comment input"
          />

          {/* Character counter */}
          {isNearLimit && (
            <div className={`text-xs mt-1 ${remainingChars < 0 ? 'text-red-500' : 'text-gray-500'}`}>
              {remainingChars} characters remaining
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-500 mt-1" role="alert">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {/* Timestamp checkbox */}
              {videoCurrentTime !== undefined && (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachTimestamp}
                    onChange={(e) => setAttachTimestamp(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    Link to timestamp ({Math.floor(videoCurrentTime / 60)}:{(Math.floor(videoCurrentTime) % 60).toString().padStart(2, '0')})
                  </span>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!content.trim() || content.length > maxLength}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {parentCommentId ? 'Reply' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
