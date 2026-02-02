'use client';

import React from 'react';
import type { VideoDetail } from '@/types/api';

interface VideoModerationTableProps {
  videos: VideoDetail[];
  selectedIds: Set<string>;
  onSelectVideo: (videoId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onVideoClick: (video: VideoDetail) => void;
  isLoading?: boolean;
}

export function VideoModerationTable({
  videos,
  selectedIds,
  onSelectVideo,
  onSelectAll,
  onDeselectAll,
  onVideoClick,
  isLoading = false,
}: VideoModerationTableProps) {
  const allSelected = videos.length > 0 && videos.every((v) => selectedIds.has(v.id));
  const someSelected = videos.some((v) => selectedIds.has(v.id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading videos">
        <span className="sr-only">Loading videos...</span>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
            <div className="flex items-start space-x-4">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="w-40 h-24 bg-gray-200 rounded" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No videos found</h3>
          <p className="text-gray-600">Try adjusting your filters or search criteria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select All Header */}
      <div className="bg-white rounded-lg shadow px-4 py-3 flex items-center space-x-3">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(input) => {
            if (input) {
              input.indeterminate = someSelected;
            }
          }}
          onChange={handleSelectAll}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          aria-label={allSelected ? 'Deselect all videos on page' : 'Select all videos on page'}
        />
        <span className="text-sm font-medium text-gray-700">
          {allSelected
            ? 'Deselect all on page'
            : someSelected
            ? 'Select all on page'
            : 'Select all on page'}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-sm text-gray-600">
            ({selectedIds.size} selected)
          </span>
        )}
      </div>

      {/* Video Cards */}
      {videos.map((video) => (
        <div
          key={video.id}
          className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${
            selectedIds.has(video.id) ? 'ring-2 ring-primary-500' : ''
          }`}
        >
          <div className="p-4">
            <div className="flex items-start space-x-4">
              {/* Checkbox */}
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(video.id)}
                  onChange={() => onSelectVideo(video.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  aria-label={`Select ${video.title}`}
                />
              </div>

              {/* Thumbnail */}
              <div
                className="w-40 flex-shrink-0 cursor-pointer"
                onClick={() => onVideoClick(video)}
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-24 object-cover rounded"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className="cursor-pointer"
                  onClick={() => onVideoClick(video)}
                >
                  <h3 className="text-base font-semibold text-gray-900 mb-1 hover:text-primary-600 transition-colors">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {video.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {/* Band */}
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span>{video.band.name}</span>
                  </div>

                  {/* Category */}
                  {video.category ? (
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      <span>{video.category.name}</span>
                    </div>
                  ) : (
                    <span className="text-yellow-600 font-medium">Uncategorized</span>
                  )}

                  {/* Opponent */}
                  {video.opponentBand && (
                    <div className="flex items-center space-x-1">
                      <span>vs</span>
                      <span>{video.opponentBand.name}</span>
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Views */}
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span>{video.viewCount.toLocaleString()} views</span>
                  </div>

                  {/* Hidden Status */}
                  {video.isHidden && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Hidden
                    </span>
                  )}
                </div>

                {/* Tags */}
                {video.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {video.tags.slice(0, 5).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {video.tags.length > 5 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        +{video.tags.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
