'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/admin/StatCard';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { QuickActions } from '@/components/admin/QuickActions';
import { ChartCard } from '@/components/admin/ChartCard';
import { VideoChart } from '@/components/admin/VideoChart';
import { CategoryPieChart } from '@/components/admin/CategoryPieChart';
import { BandBarChart } from '@/components/admin/BandBarChart';

// Types
interface DashboardStats {
  totalVideos: number;
  totalBands: number;
  videosThisWeek: number;
  pendingModeration: number;
  lastSyncStatus?: string;
  lastSyncTime?: string;
}

interface RecentVideo {
  id: string;
  title: string;
  bandName: string;
  thumbnailUrl: string;
  createdAt: string;
  isHidden: boolean;
}

interface SyncJob {
  id: string;
  status: string;
  videosFound: number;
  videosAdded: number;
  videosUpdated: number;
  createdAt: string;
  completedAt?: string;
  bandName?: string;
}

interface RecentActivity {
  recentVideos: RecentVideo[];
  recentSyncJobs: SyncJob[];
}

interface SyncStatus {
  isRunning: boolean;
  currentJob?: SyncJob;
  failedJobs: SyncJob[];
}

interface VideoTrend {
  date: string;
  count: number;
}

interface CategoryDistribution {
  name: string;
  count: number;
  slug: string;
}

interface TopBand {
  id: string;
  name: string;
  videoCount: number;
  schoolName: string;
}

interface ActivityItem {
  id: string;
  type: 'video' | 'sync' | 'error';
  title: string;
  description: string;
  timestamp: Date;
  status?: 'success' | 'failed' | 'running';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [videoTrends, setVideoTrends] = useState<VideoTrend[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [topBands, setTopBands] = useState<TopBand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Get auth token from localStorage
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminToken');
    }
    return null;
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch all dashboard data in parallel
      const [statsRes, activityRes, syncRes, trendsRes, categoryRes, bandsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard/stats`, { headers }),
        fetch(`${API_URL}/api/admin/dashboard/recent-activity`, { headers }),
        fetch(`${API_URL}/api/admin/dashboard/sync-status`, { headers }),
        fetch(`${API_URL}/api/admin/dashboard/video-trends`, { headers }),
        fetch(`${API_URL}/api/admin/dashboard/category-distribution`, { headers }),
        fetch(`${API_URL}/api/admin/dashboard/top-bands`, { headers }),
      ]);

      if (!statsRes.ok || !activityRes.ok || !syncRes.ok || !trendsRes.ok || !categoryRes.ok || !bandsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statsData, activityData, syncData, trendsData, categoryData, bandsData] = await Promise.all([
        statsRes.json(),
        activityRes.json(),
        syncRes.json(),
        trendsRes.json(),
        categoryRes.json(),
        bandsRes.json(),
      ]);

      setStats(statsData);
      setActivity(activityData);
      setSyncStatus(syncData);
      setVideoTrends(trendsData);
      setCategoryDistribution(categoryData);
      setTopBands(bandsData);
      setIsSyncing(syncData.isRunning);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  // Trigger sync
  const handleTriggerSync = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/api/sync/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }

      alert('Sync job triggered successfully!');
      // Refresh sync status
      setTimeout(() => fetchDashboardData(), 1000);
    } catch (err) {
      console.error('Error triggering sync:', err);
      alert('Failed to trigger sync job');
    }
  };

  // Poll sync status when sync is running
  useEffect(() => {
    if (isSyncing) {
      const interval = setInterval(() => {
        fetchDashboardData();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isSyncing, fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Convert activity data to ActivityItem format
  const getActivityItems = (): ActivityItem[] => {
    if (!activity) return [];

    const items: ActivityItem[] = [];

    // Add recent videos
    activity.recentVideos.forEach((video) => {
      items.push({
        id: video.id,
        type: 'video',
        title: video.title,
        description: `Added by ${video.bandName}${video.isHidden ? ' (Hidden)' : ''}`,
        timestamp: new Date(video.createdAt),
      });
    });

    // Add recent sync jobs
    activity.recentSyncJobs.forEach((job) => {
      const status = job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'failed' : 'running';
      items.push({
        id: job.id,
        type: 'sync',
        title: `Sync Job ${job.status.toLowerCase()}`,
        description: `${job.videosAdded} videos added, ${job.videosUpdated} updated${job.bandName ? ` for ${job.bandName}` : ''}`,
        timestamp: new Date(job.completedAt || job.createdAt),
        status,
      });
    });

    // Sort by timestamp, most recent first
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
  };

  // Quick actions configuration
  const quickActions = [
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      label: 'Trigger Full Sync',
      onClick: handleTriggerSync,
      variant: 'primary' as const,
      disabled: isSyncing,
    },
    {
      icon: (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      label: 'Moderate Videos',
      href: '/admin/videos',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: 'Manage Bands',
      href: '/admin/bands',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      label: 'View Sync Jobs',
      href: '/admin/sync',
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-bold text-red-900">Error Loading Dashboard</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to the HBCU Band Hub Admin Dashboard</p>
      </div>

      {/* Sync Status Alert */}
      {syncStatus?.isRunning && syncStatus.currentJob && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <p className="font-semibold text-blue-900">Sync in Progress</p>
              <p className="text-sm text-blue-800">
                {syncStatus.currentJob.videosAdded} videos added, {syncStatus.currentJob.videosUpdated} updated
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          }
          value={stats?.totalVideos.toLocaleString() || '0'}
          label="Total Videos"
          isLoading={isLoading}
        />
        <StatCard
          icon={
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          }
          value={stats?.totalBands.toLocaleString() || '0'}
          label="Total Bands"
          isLoading={isLoading}
        />
        <StatCard
          icon={
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          }
          value={stats?.videosThisWeek.toLocaleString() || '0'}
          label="Videos This Week"
          isLoading={isLoading}
        />
        <StatCard
          icon={
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          }
          value={stats?.pendingModeration.toLocaleString() || '0'}
          label="Pending Moderation"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions actions={quickActions} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Videos Added Over Time"
          description="Last 30 days"
          isLoading={isLoading}
        >
          {videoTrends.length > 0 ? (
            <VideoChart data={videoTrends} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Category Distribution"
          description="Videos by category"
          isLoading={isLoading}
        >
          {categoryDistribution.length > 0 ? (
            <CategoryPieChart data={categoryDistribution} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </ChartCard>
      </div>

      {/* Top Bands Chart */}
      <ChartCard
        title="Top 10 Bands by Video Count"
        description="Bands with the most videos"
        isLoading={isLoading}
      >
        {topBands.length > 0 ? (
          <BandBarChart data={topBands} />
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No data available
          </div>
        )}
      </ChartCard>

      {/* Activity Feed */}
      <ActivityFeed activities={getActivityItems()} isLoading={isLoading} />
    </div>
  );
}
