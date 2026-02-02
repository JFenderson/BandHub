'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  bandName?: string;
}

interface SyncStatus {
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  videosFound?: number;
  videosAdded?: number;
  videosUpdated?: number;
  errors?: string[];
}

export default function SyncProgressModal({
  isOpen,
  onClose,
  jobId,
  bandName,
}: SyncProgressModalProps) {
  const [status, setStatus] = useState<SyncStatus>({
    status: 'queued',
    videosFound: 0,
    videosAdded: 0,
    videosUpdated: 0,
    errors: [],
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !jobId) return;

    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await apiClient.getSyncJobStatus(jobId);
        setStatus({
          status: response.status || 'queued',
          videosFound: response.videosFound || 0,
          videosAdded: response.videosAdded || 0,
          videosUpdated: response.videosUpdated || 0,
          errors: response.errors || [],
        });

        // Stop polling if completed or failed
        if (response.status === 'completed' || response.status === 'failed') {
          clearInterval(intervalId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
        clearInterval(intervalId);
      }
    };

    // Poll every 2 seconds
    pollStatus(); // Initial poll
    intervalId = setInterval(pollStatus, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const getStatusText = () => {
    switch (status.status) {
      case 'queued':
        return 'Sync job queued...';
      case 'in_progress':
        return 'Syncing videos...';
      case 'completed':
        return 'Sync completed!';
      case 'failed':
        return 'Sync failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'queued':
        return 'text-blue-600';
      case 'in_progress':
        return 'text-yellow-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const progress = status.videosFound
    ? (((status.videosAdded ?? 0) + (status.videosUpdated ?? 0)) / status.videosFound) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={status.status === 'completed' || status.status === 'failed' ? onClose : undefined}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {bandName ? `Syncing ${bandName}` : 'Sync Progress'}
            </h2>
            {(status.status === 'completed' || status.status === 'failed') && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Status */}
            <div className="text-center">
              <p className={`text-lg font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
            </div>

            {/* Progress Bar */}
            {status.status === 'in_progress' && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Loading Spinner */}
            {(status.status === 'queued' || status.status === 'in_progress') && (
              <div className="flex justify-center">
                <svg
                  className="animate-spin h-10 w-10 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}

            {/* Stats */}
            {(status.videosFound ?? 0) > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{status.videosFound}</p>
                  <p className="text-sm text-gray-600">Found</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{status.videosAdded}</p>
                  <p className="text-sm text-gray-600">Added</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{status.videosUpdated}</p>
                  <p className="text-sm text-gray-600">Updated</p>
                </div>
              </div>
            )}

            {/* Errors */}
            {status.errors && status.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                <ul className="text-sm text-red-700 space-y-1">
                  {status.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Close Button */}
            {(status.status === 'completed' || status.status === 'failed') && (
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
