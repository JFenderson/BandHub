/**
 * ReactionPicker component - Emoji/reaction selector for comments
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';

// Standard reactions
const STANDARD_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Band-specific reactions
const BAND_REACTIONS = ['🎺', '🥁', '🎷', '📯', '🎵', '🏈', '🎉'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelect,
  onClose,
  isOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'band'>('standard');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const reactions = activeTab === 'standard' ? STANDARD_REACTIONS : BAND_REACTIONS;

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a reaction"
      className="absolute bottom-full mb-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2"
      style={{ minWidth: '240px' }}
    >
      {/* Tab selector */}
      <div role="tablist" aria-label="Reaction categories" className="flex gap-2 mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          role="tab"
          id="tab-standard"
          aria-selected={activeTab === 'standard'}
          aria-controls="tabpanel-standard"
          onClick={() => setActiveTab('standard')}
          className={`px-3 py-1 text-sm rounded ${
            activeTab === 'standard'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Standard
        </button>
        <button
          role="tab"
          id="tab-band"
          aria-selected={activeTab === 'band'}
          aria-controls="tabpanel-band"
          onClick={() => setActiveTab('band')}
          className={`px-3 py-1 text-sm rounded ${
            activeTab === 'band'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Band
        </button>
      </div>

      {/* Reaction grid */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="grid grid-cols-6 gap-2"
      >
        {reactions.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
