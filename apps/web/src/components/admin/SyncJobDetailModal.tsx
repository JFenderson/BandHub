'use client';

import React, { useState } from 'react';
import { SyncJobDetail } from '@/app/admin/sync-jobs/page';

interface SyncJobDetailModalProps {
  job: SyncJobDetail;
  apiUrl: string;
  getAuthToken: () => string | null;
  onClose: () => void;
}

export function SyncJobDetailModal({ job, apiUrl, getAuthToken, onClose }: SyncJobDetailModalProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!confirm('Are you sure you want to retry this job?')) return;

    setRetrying(true);
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`${apiUrl}/api/admin/sync-jobs/${job.id}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to retry job');
      }

      alert('Job retry queued successfully!');
      onClose();
    } catch (err) {
      console.error('Error retrying job:', err);
      alert('Failed to retry job');
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Sync Job Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Job ID</label>
              <p className="mt-1 text-sm text-gray-900">{job.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Job Type</label>
              <p className="mt-1 text-sm text-gray-900">{job.jobType.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Band</label>
              <p className="mt-1 text-sm text-gray-900">{job.bandName || 'All Bands'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className="mt-1">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </span>
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(job.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Started At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(job.startedAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Completed At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(job.completedAt)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="text-sm font-medium text-blue-600">Videos Found</label>
              <p className="mt-1 text-2xl font-bold text-blue-900">{job.videosFound}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <label className="text-sm font-medium text-green-600">Videos Added</label>
              <p className="mt-1 text-2xl font-bold text-green-900">{job.videosAdded}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <label className="text-sm font-medium text-yellow-600">Videos Updated</label>
              <p className="mt-1 text-2xl font-bold text-yellow-900">{job.videosUpdated}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <label className="text-sm font-medium text-purple-600">Duration</label>
              <p className="mt-1 text-2xl font-bold text-purple-900">{formatDuration(job.duration)}</p>
            </div>
          </div>

          {/* Errors */}
          {job.errors.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-2">Errors ({job.errors.length})</label>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                <ul className="list-disc list-inside space-y-1">
                  {job.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-800">{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            {job.status === 'FAILED' && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {retrying ? 'Retrying...' : 'Retry Job'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
