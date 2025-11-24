'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { VideoDetail } from '@/types/api';

interface VideoDetailModalProps {
  isOpen: boolean;
  video: VideoDetail | null;
  bands: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (
    videoId: string,
    updates: {
      categoryId?: string;
      opponentBandId?: string;
      eventName?: string;
      eventYear?: number;
      tags?: string[];
      qualityScore?: number;
      isHidden?: boolean;
      hideReason?: string;
    }
  ) => Promise<void>;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function VideoDetailModal({
  isOpen,
  video,
  bands,
  categories,
  onClose,
  onSave,
  onNavigate,
}: VideoDetailModalProps) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [opponentBandId, setOpponentBandId] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [eventYear, setEventYear] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [hideReason, setHideReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load video data into form
  useEffect(() => {
    if (video) {
      setCategoryId(video.category?.id || '');
      setOpponentBandId(video.opponentBand?.id || '');
      setEventName(video.eventName || '');
      setEventYear(video.eventYear?.toString() || '');
      setTags(video.tags.join(', '));
      setQualityScore(video.qualityScore);
      setIsHidden(video.isHidden);
      setHideReason(video.hideReason || '');
    }
  }, [video]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !video) return;

      // Esc to close
      if (e.key === 'Escape') {
        onClose();
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // Call save logic directly
        if (isSaving) return;
        
        setIsSaving(true);
        const updates: any = {};

        if (categoryId !== (video.category?.id || '')) {
          updates.categoryId = categoryId || null;
        }

        if (opponentBandId !== (video.opponentBand?.id || '')) {
          updates.opponentBandId = opponentBandId || null;
        }

        if (eventName !== (video.eventName || '')) {
          updates.eventName = eventName;
        }

        const yearNum = eventYear ? parseInt(eventYear, 10) : undefined;
        if (yearNum !== video.eventYear) {
          updates.eventYear = yearNum;
        }

        const tagArray = tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (JSON.stringify(tagArray) !== JSON.stringify(video.tags)) {
          updates.tags = tagArray;
        }

        if (qualityScore !== video.qualityScore) {
          updates.qualityScore = qualityScore;
        }

        if (isHidden !== video.isHidden) {
          updates.isHidden = isHidden;
        }

        if (hideReason !== (video.hideReason || '')) {
          updates.hideReason = hideReason;
        }

        onSave(video.id, updates).finally(() => setIsSaving(false));
      }

      // Arrow keys for navigation
      if (onNavigate) {
        if (e.key === 'ArrowLeft') {
          onNavigate('prev');
        } else if (e.key === 'ArrowRight') {
          onNavigate('next');
        }
      }
    },
    [isOpen, video, onClose, onNavigate, isSaving, categoryId, opponentBandId, eventName, eventYear, tags, qualityScore, isHidden, hideReason, onSave]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = async () => {
    if (!video) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (categoryId !== (video.category?.id || '')) {
        updates.categoryId = categoryId || null;
      }

      if (opponentBandId !== (video.opponentBand?.id || '')) {
        updates.opponentBandId = opponentBandId || null;
      }

      if (eventName !== (video.eventName || '')) {
        updates.eventName = eventName;
      }

      const yearNum = eventYear ? parseInt(eventYear, 10) : undefined;
      if (yearNum !== video.eventYear) {
        updates.eventYear = yearNum;
      }

      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (JSON.stringify(tagArray) !== JSON.stringify(video.tags)) {
        updates.tags = tagArray;
      }

      if (qualityScore !== video.qualityScore) {
        updates.qualityScore = qualityScore;
      }

      if (isHidden !== video.isHidden) {
        updates.isHidden = isHidden;
      }

      if (hideReason !== (video.hideReason || '')) {
        updates.hideReason = hideReason;
      }

      await onSave(video.id, updates);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !video) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video Preview */}
          <div className="mb-6">
            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{video.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{video.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>{video.band.name}</span>
              <span>•</span>
              <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{video.viewCount.toLocaleString()} views</span>
            </div>
          </div>

          {/* Edit Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Opponent Band */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opponent Band (Optional)
              </label>
              <select
                value={opponentBandId}
                onChange={(e) => setOpponentBandId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">No Opponent</option>
                {bands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Name
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Honda Battle of the Bands"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Event Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Year
              </label>
              <input
                type="number"
                value={eventYear}
                onChange={(e) => setEventYear(e.target.value)}
                placeholder="e.g., 2024"
                min="1990"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Tags */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., halftime show, fifth quarter, battle"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Quality Score */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality Score: {qualityScore}
              </label>
              <input
                type="range"
                value={qualityScore}
                onChange={(e) => setQualityScore(parseInt(e.target.value, 10))}
                min="0"
                max="100"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low (0)</span>
                <span>High (100)</span>
              </div>
            </div>

            {/* Hide Toggle */}
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHidden}
                  onChange={(e) => setIsHidden(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Hide from public view</span>
              </label>
            </div>

            {/* Hide Reason */}
            {isHidden && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hide Reason
                </label>
                <textarea
                  value={hideReason}
                  onChange={(e) => setHideReason(e.target.value)}
                  placeholder="Reason for hiding this video..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Press <kbd className="px-2 py-1 bg-white border rounded">Esc</kbd> to close,{' '}
            <kbd className="px-2 py-1 bg-white border rounded">Cmd/Ctrl + S</kbd> to save
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
