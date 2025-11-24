'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { SyncJobTable } from '@/components/admin/SyncJobTable';
import { SyncJobDetailModal } from '@/components/admin/SyncJobDetailModal';
import { QueueStatusDashboard } from '@/components/admin/QueueStatusDashboard';
import { SyncTriggerModal } from '@/components/admin/SyncTriggerModal';
import { ErrorTrackingPanel } from '@/components/admin/ErrorTrackingPanel';

// Types
export interface SyncJobDetail {
  id: string;
  bandId?: string;
  bandName?: string;
  jobType: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'SINGLE_VIDEO';
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  videosFound: number;
  videosAdded: number;
  videosUpdated: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  duration?: number;
}

export interface SyncJobFilters {
  status?: string;
  jobType?: string;
  bandId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export default function SyncJobsPage() {
  const [selectedJob, setSelectedJob] = useState<SyncJobDetail | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [filters, setFilters] = useState<SyncJobFilters>({ page: 1, limit: 20 });
  const [refreshInterval, setRefreshInterval] = useState<number | null>(30000); // 30 seconds

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Get auth token from localStorage
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminToken');
    }
    return null;
  };

  const handleJobClick = (job: SyncJobDetail) => {
    setSelectedJob(job);
  };

  const handleTriggerSync = () => {
    setShowTriggerModal(true);
  };

  const handleFiltersChange = (newFilters: SyncJobFilters) => {
    setFilters({ ...filters, ...newFilters, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Jobs</h1>
          <p className="text-gray-600 mt-1">Monitor and manage video sync operations</p>
        </div>
        <button
          onClick={handleTriggerSync}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Trigger Sync</span>
        </button>
      </div>

      {/* Queue Status Dashboard */}
      <QueueStatusDashboard apiUrl={API_URL} getAuthToken={getAuthToken} />

      {/* Error Tracking Panel */}
      <ErrorTrackingPanel apiUrl={API_URL} getAuthToken={getAuthToken} />

      {/* Sync Jobs Table */}
      <SyncJobTable
        apiUrl={API_URL}
        getAuthToken={getAuthToken}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onJobClick={handleJobClick}
        refreshInterval={refreshInterval}
      />

      {/* Modals */}
      {selectedJob && (
        <SyncJobDetailModal
          job={selectedJob}
          apiUrl={API_URL}
          getAuthToken={getAuthToken}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {showTriggerModal && (
        <SyncTriggerModal
          apiUrl={API_URL}
          getAuthToken={getAuthToken}
          onClose={() => setShowTriggerModal(false)}
          onSuccess={() => {
            setShowTriggerModal(false);
            // Refresh table
            setFilters({ ...filters });
          }}
        />
      )}
    </div>
  );
}
