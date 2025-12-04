'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface SyncJob {
  id: string;
  bandId?: string;
  bandName?: string;
  jobType: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'SINGLE_VIDEO' | 'CHANNEL_SYNC';
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  videosFound: number;
  videosAdded: number;
  videosUpdated: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  quotaUsed?: number;
  errorMessage?: string;
}

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface Band {
  id: string;
  name: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  show: boolean;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_SYNC: 'Full Sync',
  INCREMENTAL_SYNC: 'Incremental',
  SINGLE_VIDEO: 'Single Video',
  CHANNEL_SYNC: 'Channel Sync',
};

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function SyncManagementPage() {
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  
  // Polling
  const [isPolling, setIsPolling] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Trigger Sync Modal
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [syncType, setSyncType] = useState<'channel' | 'playlist' | 'search'>('channel');
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchSyncJobs = useCallback(async () => {
    try {
      const response = await apiClient.getSyncJobs({
        status: statusFilter || undefined,
        jobType: typeFilter || undefined,
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setSyncJobs(response.data);
      setTotal(response.meta.total);
      setTotalPages(response.meta.totalPages);
    } catch (err) {
      console.error('Failed to fetch sync jobs:', err);
    }
  }, [statusFilter, typeFilter, page, limit]);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const status = await apiClient.getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  }, []);

  const fetchBands = useCallback(async () => {
    try {
      const response = await apiClient.getBands({ limit: 100 });
      setBands(response.data.map((b: any) => ({ id: b.id, name: b.name })));
    } catch (err) {
      console.error('Failed to fetch bands:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([fetchSyncJobs(), fetchQueueStatus()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchSyncJobs, fetchQueueStatus]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
    fetchBands();
  }, [fetchAll, fetchBands]);

  // Polling for real-time updates
  useEffect(() => {
    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        fetchAll();
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isPolling, fetchAll]);

  const handleTriggerSync = async () => {
    setIsTriggeringSync(true);
    try {
      if (selectedBandId) {
        await apiClient.triggerBandSync(selectedBandId, syncType);
        showToast(`Band sync triggered successfully`, 'success');
      } else {
        await apiClient.triggerManualSync({});
        showToast('Full sync triggered successfully', 'success');
      }
      setShowTriggerModal(false);
      setSelectedBandId('');
      fetchAll();
    } catch (err) {
      console.error('Failed to trigger sync:', err);
      showToast(err instanceof Error ? err.message : 'Failed to trigger sync', 'error');
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await apiClient.retrySyncJob(jobId);
      showToast('Job retry queued', 'success');
      fetchAll();
    } catch (err) {
      console.error('Failed to retry job:', err);
      showToast(err instanceof Error ? err.message : 'Failed to retry job', 'error');
    }
  };

  const handlePauseQueue = async () => {
    try {
      await apiClient.pauseQueue();
      showToast('Queue paused', 'success');
      fetchQueueStatus();
    } catch (err) {
      console.error('Failed to pause queue:', err);
      showToast(err instanceof Error ? err.message : 'Failed to pause queue', 'error');
    }
  };

  const handleResumeQueue = async () => {
    try {
      await apiClient.resumeQueue();
      showToast('Queue resumed', 'success');
      fetchQueueStatus();
    } catch (err) {
      console.error('Failed to resume queue:', err);
      showToast(err instanceof Error ? err.message : 'Failed to resume queue', 'error');
    }
  };

  const handleClearFailed = async () => {
    try {
      await apiClient.clearFailedJobs();
      showToast('Failed jobs cleared', 'success');
      fetchAll();
    } catch (err) {
      console.error('Failed to clear failed jobs:', err);
      showToast(err instanceof Error ? err.message : 'Failed to clear failed jobs', 'error');
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string): string => {
    if (!startedAt) return '—';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Calculate aggregate stats
  const totalWaiting = queueStatus.reduce((sum, q) => sum + q.waiting, 0);
  const totalActive = queueStatus.reduce((sum, q) => sum + q.active, 0);
  const totalCompleted = queueStatus.reduce((sum, q) => sum + q.completed, 0);
  const totalFailed = queueStatus.reduce((sum, q) => sum + q.failed, 0);
  const isPaused = queueStatus.some(q => q.paused);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sync Management</h2>
          <p className="text-gray-600 mt-1">
            Monitor and manage YouTube video synchronization
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isPolling}
              onChange={(e) => setIsPolling(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Auto-refresh</span>
          </label>
          <button
            onClick={() => setShowTriggerModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Trigger Sync</span>
          </button>
        </div>
      </div>

      {/* Queue Status Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Waiting</div>
          <div className="text-2xl font-bold text-yellow-600">{totalWaiting}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-blue-600">{totalActive}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Failed</div>
          <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Status</div>
          <div className={`text-2xl font-bold ${isPaused ? 'text-orange-600' : 'text-green-600'}`}>
            {isPaused ? 'Paused' : 'Running'}
          </div>
        </div>
      </div>

      {/* Queue Controls */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Queue Controls:</span>
          <button
            onClick={handlePauseQueue}
            disabled={isPaused}
            className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50 transition-colors"
          >
            Pause
          </button>
          <button
            onClick={handleResumeQueue}
            disabled={!isPaused}
            className="px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={handleClearFailed}
            disabled={totalFailed === 0}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            Clear Failed
          </button>
        </div>
        <button
          onClick={() => fetchAll()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center space-x-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="FULL_SYNC">Full Sync</option>
              <option value="INCREMENTAL_SYNC">Incremental</option>
              <option value="CHANNEL_SYNC">Channel Sync</option>
              <option value="SINGLE_VIDEO">Single Video</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setTypeFilter('');
                setPage(1);
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Sync Jobs Table */}
      {!isLoading && syncJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {syncJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {job.bandName || 'All Bands'}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={job.id}>
                      {job.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>Found: {job.videosFound}</div>
                    <div className="text-xs">
                      +{job.videosAdded} new / {job.videosUpdated} updated
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(job.startedAt, job.completedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {job.status === 'FAILED' && (
                      <button
                        onClick={() => handleRetryJob(job.id)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Retry
                      </button>
                    )}
                    {job.errors && job.errors.length > 0 && (
                      <button
                        onClick={() => showToast(job.errors.join(', '), 'error')}
                        className="text-red-600 hover:text-red-900 ml-3"
                        title="View errors"
                      >
                        Errors ({job.errors.length})
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && syncJobs.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No sync jobs found</h3>
          <p className="text-gray-600 mb-4">Trigger a sync to start fetching videos from YouTube.</p>
          <button
            onClick={() => setShowTriggerModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Trigger Sync
          </button>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow px-6 py-4">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} jobs
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Trigger Sync Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trigger Sync</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Band (optional)
                </label>
                <select
                  value={selectedBandId}
                  onChange={(e) => setSelectedBandId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Bands (Full Sync)</option>
                  {bands.map(band => (
                    <option key={band.id} value={band.id}>{band.name}</option>
                  ))}
                </select>
              </div>
              
              {selectedBandId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Type
                  </label>
                  <select
                    value={syncType}
                    onChange={(e) => setSyncType(e.target.value as 'channel' | 'playlist' | 'search')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="channel">Channel Videos</option>
                    <option value="playlist">Playlist Videos</option>
                    <option value="search">Search Videos</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTriggerModal(false);
                  setSelectedBandId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerSync}
                disabled={isTriggeringSync}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isTriggeringSync ? 'Triggering...' : 'Start Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 max-w-md ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}
        >
          <div className="line-clamp-3">{toast.message}</div>
        </div>
      )}
    </div>
  );
}
