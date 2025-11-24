'use client';

import React, { useState, useEffect } from 'react';
import { SyncJobDetail, SyncJobFilters } from '@/app/admin/sync-jobs/page';

interface SyncJobTableProps {
  apiUrl: string;
  getAuthToken: () => string | null;
  filters: SyncJobFilters;
  onFiltersChange: (filters: SyncJobFilters) => void;
  onJobClick: (job: SyncJobDetail) => void;
  refreshInterval: number | null;
}

export function SyncJobTable({
  apiUrl,
  getAuthToken,
  filters,
  onFiltersChange,
  onJobClick,
  refreshInterval,
}: SyncJobTableProps) {
  const [jobs, setJobs] = useState<SyncJobDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.jobType) params.append('jobType', filters.jobType);
      if (filters.bandId) params.append('bandId', filters.bandId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', String(filters.page || 1));
      params.append('limit', String(filters.limit || 20));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`${apiUrl}/api/admin/sync-jobs?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync jobs');
      }

      const data = await response.json();
      setJobs(data.data);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      console.error('Error fetching sync jobs:', err);
      setError('Failed to load sync jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filters]);

  // Auto-refresh for in-progress jobs
  useEffect(() => {
    if (!refreshInterval) return;

    const hasActiveJobs = jobs.some(
      (job) => job.status === 'IN_PROGRESS' || job.status === 'QUEUED'
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(fetchJobs, refreshInterval);
    return () => clearInterval(interval);
  }, [jobs, refreshInterval]);

  const getStatusBadge = (status: string) => {
    const badges = {
      QUEUED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.status || ''}
            onChange={(e) => onFiltersChange({ status: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={filters.jobType || ''}
            onChange={(e) => onFiltersChange({ jobType: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Job Types</option>
            <option value="FULL_SYNC">Full Sync</option>
            <option value="INCREMENTAL_SYNC">Incremental Sync</option>
            <option value="SINGLE_VIDEO">Single Video</option>
          </select>

          <select
            value={filters.sortBy || 'createdAt'}
            onChange={(e) => onFiltersChange({ sortBy: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Created At</option>
            <option value="startedAt">Started At</option>
            <option value="completedAt">Completed At</option>
          </select>

          <select
            value={filters.sortOrder || 'desc'}
            onChange={(e) => onFiltersChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Band
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Videos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onJobClick(job)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{job.jobType.replace('_', ' ')}</div>
                  <div className="text-sm text-gray-500">{job.id.substring(0, 8)}...</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{job.bandName || 'All Bands'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    Found: {job.videosFound}
                  </div>
                  <div className="text-sm text-gray-500">
                    Added: {job.videosAdded} | Updated: {job.videosUpdated}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDuration(job.duration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(job.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobClick(job);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > (filters.limit || 20) && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
            {Math.min((filters.page || 1) * (filters.limit || 20), total)} of {total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onFiltersChange({ page: (filters.page || 1) - 1 })}
              disabled={(filters.page || 1) === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => onFiltersChange({ page: (filters.page || 1) + 1 })}
              disabled={(filters.page || 1) * (filters.limit || 20) >= total}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
