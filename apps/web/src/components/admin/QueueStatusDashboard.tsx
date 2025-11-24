'use client';

import React, { useState, useEffect } from 'react';
import { QueueStatus } from '@/app/admin/sync-jobs/page';

interface QueueStatusDashboardProps {
  apiUrl: string;
  getAuthToken: () => string | null;
}

export function QueueStatusDashboard({ apiUrl, getAuthToken }: QueueStatusDashboardProps) {
  const [queues, setQueues] = useState<QueueStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueueStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${apiUrl}/api/admin/queue/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch queue status');
      }

      const data = await response.json();
      setQueues(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching queue status:', err);
      setError('Failed to load queue status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handlePauseQueue = async () => {
    if (!confirm('Are you sure you want to pause the sync queue?')) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/admin/queue/pause`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to pause queue');
      }

      alert('Queue paused successfully');
      fetchQueueStatus();
    } catch (err) {
      console.error('Error pausing queue:', err);
      alert('Failed to pause queue');
    }
  };

  const handleResumeQueue = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/admin/queue/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to resume queue');
      }

      alert('Queue resumed successfully');
      fetchQueueStatus();
    } catch (err) {
      console.error('Error resuming queue:', err);
      alert('Failed to resume queue');
    }
  };

  const handleClearFailed = async () => {
    if (!confirm('Are you sure you want to clear all failed jobs? This cannot be undone.')) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/admin/queue/clear-failed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear failed jobs');
      }

      const data = await response.json();
      alert(`${data.count} failed jobs cleared successfully`);
      fetchQueueStatus();
    } catch (err) {
      console.error('Error clearing failed jobs:', err);
      alert('Failed to clear failed jobs');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
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
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Queue Status</h3>
        <div className="flex space-x-2">
          <button
            onClick={handlePauseQueue}
            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Pause Queue
          </button>
          <button
            onClick={handleResumeQueue}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
          >
            Resume Queue
          </button>
          <button
            onClick={handleClearFailed}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Failed
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {queues.map((queue) => (
            <div key={queue.name} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">{queue.name}</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Waiting:</span>
                  <span className="ml-2 font-semibold text-blue-600">{queue.waiting}</span>
                </div>
                <div>
                  <span className="text-gray-500">Active:</span>
                  <span className="ml-2 font-semibold text-green-600">{queue.active}</span>
                </div>
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2 font-semibold text-gray-600">{queue.completed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Failed:</span>
                  <span className="ml-2 font-semibold text-red-600">{queue.failed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Delayed:</span>
                  <span className="ml-2 font-semibold text-yellow-600">{queue.delayed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-semibold ${queue.paused ? 'text-red-600' : 'text-green-600'}`}>
                    {queue.paused ? 'Paused' : 'Running'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
