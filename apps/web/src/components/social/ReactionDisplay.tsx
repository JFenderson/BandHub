/**
 * ReactionDisplay component - Shows reactions on a comment with counts
 */
'use client';

import React, { useState } from 'react';
import type { ReactionGroup } from '../../types/comments';

interface ReactionDisplayProps {
  reactions: ReactionGroup[];
  onReact: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
}

export const ReactionDisplay: React.FC<ReactionDisplayProps> = ({
  reactions,
  onReact,
  onRemoveReaction,
}) => {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);

  if (!reactions || reactions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {reactions.map((reaction) => (
        <div key={reaction.emoji} className="relative">
          <button
            onClick={() => {
              if (reaction.userReacted) {
                onRemoveReaction(reaction.emoji);
              } else {
                onReact(reaction.emoji);
              }
            }}
            onMouseEnter={() => setHoveredEmoji(reaction.emoji)}
            onMouseLeave={() => setHoveredEmoji(null)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
              reaction.userReacted
                ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label={`${reaction.emoji} ${reaction.count} reaction${reaction.count !== 1 ? 's' : ''}`}
          >
            <span className="text-base">{reaction.emoji}</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {reaction.count}
            </span>
          </button>

          {/* Tooltip showing who reacted */}
          {hoveredEmoji === reaction.emoji && reaction.users.length > 0 && (
            <div
              className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10"
              style={{ minWidth: '100px' }}
            >
              {reaction.users.slice(0, 5).map((user) => user.name).join(', ')}
              {reaction.users.length > 5 && ` and ${reaction.users.length - 5} more`}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
