'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { DashboardStats, RecentActivity, SyncStatus, SyncJob, RecentVideo } from '@/types/api';

/**
 * Loading skeleton for stat cards
 */
function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
      </div>
      <div className="h-3 bg-gray-200 rounded w-32 mt-2"></div>
    </div>
  );
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
  isLoading?: boolean;
  hasError?: boolean;
}

function StatCard({ label, value, icon, subtext, isLoading, hasError }: StatCardProps) {
  if (isLoading) {
    return <StatCardSkeleton />;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {hasError ? 'Error' : value}
          </p>
        </div>
        {icon}
      </div>
      {subtext && (
        <p className="text-xs text-gray-500 mt-2">{subtext}</p>
      )}
    </div>
  );
}

/**
 * Activity Feed Component
 */
interface ActivityFeedProps {
  recentVideos: RecentVideo[];
  recentSyncJobs: SyncJob[];
  isLoading: boolean;
  hasError: boolean;
}

function ActivityFeed({ recentVideos, recentSyncJobs, isLoading, hasError }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
        <p className="text-red-600">Failed to load recent activity</p>
      </div>
    );
  }

  const allActivities = [
    ...recentVideos.map((v) => ({
      id: v.id,
      type: 'video' as const,
      title: v.title,
      description: `Added by ${v.bandName}${v.isHidden ? ' (Hidden)' : ''}`,
      timestamp: new Date(v.createdAt),
    })),
    ...recentSyncJobs.map((j) => ({
      id: j.id,
      type: 'sync' as const,
      title: `Sync Job ${j.status.toLowerCase()}`,
      description: `${j.videosAdded} added, ${j.videosUpdated} updated${j.bandName ? ` for ${j.bandName}` : ''}`,
      timestamp: new Date(j.completedAt || j.createdAt),
      status: j.status,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
      {allActivities.length === 0 ? (
        <p className="text-gray-500">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {allActivities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === 'video' ? 'bg-blue-100' : 
                activity.type === 'sync' && activity.status === 'COMPLETED' ? 'bg-green-100' :
                activity.type === 'sync' && activity.status === 'FAILED' ? 'bg-red-100' :
                'bg-yellow-100'
              }`}>
                {activity.type === 'video' ? (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className={`w-4 h-4 ${
                    activity.status === 'COMPLETED' ? 'text-green-600' :
                    activity.status === 'FAILED' ? 'text-red-600' :
                    'text-yellow-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                <p className="text-xs text-gray-500">{activity.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sync Status Widget Component
 */
interface SyncStatusWidgetProps {
  syncStatus: SyncStatus | null;
  isLoading: boolean;
  hasError: boolean;
}

function SyncStatusWidget({ syncStatus, isLoading, hasError }: SyncStatusWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Sync Status</h3>
        <p className="text-red-600">Failed to load sync status</p>
      </div>
    );
  }

  if (!syncStatus) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Sync Status</h3>
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${syncStatus.isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
          <span className="text-sm text-gray-700">
            {syncStatus.isRunning ? 'Sync in progress' : 'No active sync'}
          </span>
        </div>
        {syncStatus.currentJob && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-800">Current Job</p>
            <p className="text-xs text-yellow-700 mt-1">
              {syncStatus.currentJob.videosAdded} added, {syncStatus.currentJob.videosUpdated} updated
              {syncStatus.currentJob.bandName && ` for ${syncStatus.currentJob.bandName}`}
            </p>
          </div>
        )}
        {syncStatus.failedJobs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-800">{syncStatus.failedJobs.length} failed job(s) in last 24h</p>
            <ul className="text-xs text-red-700 mt-1 space-y-1">
              {syncStatus.failedJobs.slice(0, 3).map((job) => (
                <li key={job.id}>
                  {new Date(job.createdAt).toLocaleString()}
                  {job.bandName && ` - ${job.bandName}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Error Alert Component
 */
function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
      <div className="flex items-center space-x-3">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 className="font-bold text-red-900">Error Loading Dashboard</h4>
          <p className="text-sm text-red-800">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin Dashboard Home Page
 * 
 * This is the main landing page for the admin dashboard.
 * It provides an overview of the system and quick access to management sections.
 */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingSyncStatus, setIsLoadingSyncStatus] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [syncStatusError, setSyncStatusError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    // Fetch stats
    setIsLoadingStats(true);
    try {
      const statsData = await apiClient.getDashboardStats();
      setStats(statsData);
      setStatsError(null);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStatsError(error instanceof Error ? error.message : 'Failed to load statistics');
    } finally {
      setIsLoadingStats(false);
    }

    // Fetch activity
    setIsLoadingActivity(true);
    try {
      const activityData = await apiClient.getRecentActivity();
      setActivity(activityData);
      setActivityError(null);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      setActivityError(error instanceof Error ? error.message : 'Failed to load recent activity');
    } finally {
      setIsLoadingActivity(false);
    }

    // Fetch sync status
    setIsLoadingSyncStatus(true);
    try {
      const syncData = await apiClient.getSyncStatusDashboard();
      setSyncStatus(syncData);
      setSyncStatusError(null);
    } catch (error) {
      console.error('Error fetching sync status:', error);
      setSyncStatusError(error instanceof Error ? error.message : 'Failed to load sync status');
    } finally {
      setIsLoadingSyncStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Poll sync status when sync is running
  useEffect(() => {
    if (syncStatus?.isRunning) {
      const interval = setInterval(() => {
        apiClient.getSyncStatusDashboard().then(setSyncStatus).catch(console.error);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [syncStatus?.isRunning]);

  const allErrored = statsError && activityError && syncStatusError;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Welcome to the Admin Dashboard
        </h2>
        <p className="text-gray-600">
          Manage bands, videos, events, and categories for HBCU Band Hub.
        </p>
      </div>

      {/* Show full error if all data failed to load */}
      {allErrored && (
        <ErrorAlert message="Unable to connect to the server. Please check your connection and try again." />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Bands"
          value={stats?.totalBands.toLocaleString() ?? 0}
          isLoading={isLoadingStats}
          hasError={!!statsError}
          icon={
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          }
        />

        <StatCard
          label="Total Videos"
          value={stats?.totalVideos.toLocaleString() ?? 0}
          isLoading={isLoadingStats}
          hasError={!!statsError}
          icon={
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          }
        />

        <StatCard
          label="Videos This Week"
          value={stats?.videosThisWeek.toLocaleString() ?? 0}
          isLoading={isLoadingStats}
          hasError={!!statsError}
          icon={
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          }
        />

        <StatCard
          label="Pending Moderation"
          value={stats?.pendingModeration.toLocaleString() ?? 0}
          isLoading={isLoadingStats}
          hasError={!!statsError}
          icon={
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Two Column Layout: Quick Actions and Sync Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/admin/bands"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium text-gray-900">Manage Bands</span>
            </a>

            <a
              href="/admin/videos"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-gray-900">Moderate Videos</span>
            </a>

            <a
              href="/admin/categories"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="font-medium text-gray-900">Categories</span>
            </a>

            <a
              href="/admin/sync-jobs"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium text-gray-900">Sync Jobs</span>
            </a>
          </div>
        </div>

        {/* Sync Status */}
        <SyncStatusWidget
          syncStatus={syncStatus}
          isLoading={isLoadingSyncStatus}
          hasError={!!syncStatusError}
        />
      </div>

      {/* Recent Activity */}
      <ActivityFeed
        recentVideos={activity?.recentVideos ?? []}
        recentSyncJobs={activity?.recentSyncJobs ?? []}
        isLoading={isLoadingActivity}
        hasError={!!activityError}
      />
    </div>
  );
}
