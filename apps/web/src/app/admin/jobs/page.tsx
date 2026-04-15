'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface JobMetrics {
  timestamp: string;
  queues: QueueMetrics[];
  totals: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  successRate: number;
  processingRate: number;
}

interface JobTrend {
  queueName: string;
  period: string;
  successful: number;
  failed: number;
  total: number;
  successRate: number;
  avgProcessingTime: number;
}

interface StuckJobAlert {
  jobId: string;
  queueName: string;
  jobName: string;
  stuckDuration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  startedAt: string;
  data: any;
  attemptsMade: number;
}

type Period = '24h' | '7d' | '30d';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_DISPLAY: Record<string, { label: string; color: string }> = {
  'video-sync':        { label: 'YouTube Sync',      color: 'blue' },
  'video-processing':  { label: 'Video Processing',  color: 'purple' },
  'maintenance':       { label: 'Maintenance',        color: 'gray' },
};

const SEVERITY_CONFIG: Record<StuckJobAlert['severity'], { bg: string; text: string; label: string }> = {
  low:      { bg: 'bg-yellow-100', text: 'text-yellow-800',  label: 'Low' },
  medium:   { bg: 'bg-orange-100', text: 'text-orange-800',  label: 'Medium' },
  high:     { bg: 'bg-red-100',    text: 'text-red-800',     label: 'High' },
  critical: { bg: 'bg-red-200',    text: 'text-red-900',     label: 'Critical' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function getQueueLabel(name: string): string {
  return QUEUE_DISPLAY[name]?.label ?? name;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-600', blue: 'text-blue-600', green: 'text-green-600',
    red: 'text-red-600', purple: 'text-purple-600', gray: 'text-gray-700',
  };
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [metrics, setMetrics] = useState<JobMetrics | null>(null);
  const [trends, setTrends] = useState<JobTrend[]>([]);
  const [stuckAlerts, setStuckAlerts] = useState<StuckJobAlert[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<Period>('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; show: boolean }>({
    message: '', type: 'info', show: false,
  });
  const [confirmAction, setConfirmAction] = useState<{
    title: string; body: string; onConfirm: () => Promise<void>;
  } | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await apiClient.getJobMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch job metrics:', err);
    }
  }, []);

  const fetchTrends = useCallback(async (period: Period) => {
    try {
      const data = await apiClient.getJobTrends(period);
      setTrends(data);
    } catch (err) {
      console.error('Failed to fetch job trends:', err);
    }
  }, []);

  const fetchStuckAlerts = useCallback(async () => {
    try {
      const data = await apiClient.getStuckJobAlerts();
      setStuckAlerts(data);
    } catch (err) {
      console.error('Failed to fetch stuck job alerts:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMetrics(), fetchStuckAlerts()]);
    setIsLoading(false);
  }, [fetchMetrics, fetchStuckAlerts]);

  // Initial load
  useEffect(() => {
    fetchAll();
    fetchTrends(trendPeriod);
  }, [fetchAll, fetchTrends, trendPeriod]);

  // Polling
  useEffect(() => {
    if (isPolling) {
      pollingRef.current = setInterval(fetchAll, 5000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isPolling, fetchAll]);

  // Refetch trends when period changes
  useEffect(() => {
    fetchTrends(trendPeriod);
  }, [trendPeriod, fetchTrends]);

  // ─── Queue actions ───────────────────────────────────────────────────────────

  const confirmThen = (title: string, body: string, action: () => Promise<void>) => {
    setConfirmAction({ title, body, onConfirm: action });
  };

  const handlePause = (queueName: string) => {
    confirmThen(
      `Pause ${getQueueLabel(queueName)}?`,
      'No new jobs will be picked up until resumed. In-flight jobs will complete normally.',
      async () => {
        await apiClient.pauseQueueByName(queueName);
        showToast(`${getQueueLabel(queueName)} paused`, 'success');
        fetchMetrics();
      },
    );
  };

  const handleResume = (queueName: string) => async () => {
    try {
      await apiClient.resumeQueueByName(queueName);
      showToast(`${getQueueLabel(queueName)} resumed`, 'success');
      fetchMetrics();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to resume queue', 'error');
    }
  };

  const handleClear = (queueName: string, type: 'completed' | 'failed' | 'all') => {
    const typeLabel = type === 'all' ? 'completed and failed' : type;
    confirmThen(
      `Clear ${typeLabel} jobs from ${getQueueLabel(queueName)}?`,
      'This cannot be undone. Job history will be permanently removed.',
      async () => {
        await apiClient.clearQueueByName(queueName, type);
        showToast(`Cleared ${typeLabel} jobs from ${getQueueLabel(queueName)}`, 'success');
        fetchMetrics();
      },
    );
  };

  const handleRetryStuck = (alert: StuckJobAlert) => {
    confirmThen(
      `Retry stuck job?`,
      `Job "${alert.jobName}" in ${getQueueLabel(alert.queueName)} has been active for ${formatDuration(alert.stuckDuration)}. This will create a new job and remove the stuck one.`,
      async () => {
        await apiClient.retryJob(alert.queueName, alert.jobId);
        showToast('Job retried', 'success');
        fetchAll();
      },
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const totals = metrics?.totals;
  const allPaused = metrics?.queues.every(q => q.paused) ?? false;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Job Queue Monitor</h2>
          <p className="text-gray-600 mt-1">Real-time view of all background processing queues</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isPolling}
              onChange={e => setIsPolling(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Live (5s)</span>
          </label>
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      )}

      {!isLoading && metrics && (
        <>
          {/* ── Top-level stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Waiting"        value={totals?.waiting ?? 0}                         color="yellow" />
            <StatCard label="Active"         value={totals?.active ?? 0}                          color="blue" />
            <StatCard label="Completed"      value={totals?.completed ?? 0}                       color="green" />
            <StatCard label="Failed"         value={totals?.failed ?? 0}                          color="red" />
            <StatCard label="Success Rate"   value={`${metrics.successRate.toFixed(1)}%`}         color={metrics.successRate >= 90 ? 'green' : metrics.successRate >= 70 ? 'yellow' : 'red'} />
            <StatCard label="Jobs/min"       value={metrics.processingRate}                       color="purple" />
          </div>

          {/* ── Stuck job alerts ── */}
          {stuckAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="font-semibold text-red-800">
                  {stuckAlerts.length} Stuck Job{stuckAlerts.length !== 1 ? 's' : ''} Detected
                </h3>
              </div>
              <div className="space-y-2">
                {stuckAlerts.map(alert => {
                  const sev = SEVERITY_CONFIG[alert.severity];
                  return (
                    <div key={alert.jobId} className="flex items-center justify-between bg-white rounded p-3 border border-red-100">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sev.bg} ${sev.text}`}>
                          {sev.label}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{alert.jobName}</span>
                          <span className="text-xs text-gray-500 ml-2">in {getQueueLabel(alert.queueName)}</span>
                        </div>
                        <span className="text-sm text-red-700 font-medium">
                          stuck for {formatDuration(alert.stuckDuration)}
                        </span>
                        <span className="text-xs text-gray-400">{alert.attemptsMade} attempt(s)</span>
                      </div>
                      <button
                        onClick={() => handleRetryStuck(alert)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Force Retry
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Per-queue cards ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {metrics.queues.map(queue => {
              const display = QUEUE_DISPLAY[queue.queueName] ?? { label: queue.queueName, color: 'gray' };
              return (
                <div key={queue.queueName} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Card header */}
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{display.label}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        queue.paused
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {queue.paused ? 'Paused' : 'Running'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{queue.queueName}</span>
                  </div>

                  {/* Counts */}
                  <div className="px-5 py-4 grid grid-cols-5 gap-2 text-center border-b border-gray-100">
                    {[
                      { label: 'Wait',   value: queue.waiting,   color: 'text-yellow-600' },
                      { label: 'Active', value: queue.active,    color: 'text-blue-600' },
                      { label: 'Done',   value: queue.completed, color: 'text-green-600' },
                      { label: 'Failed', value: queue.failed,    color: 'text-red-600' },
                      { label: 'Delay',  value: queue.delayed,   color: 'text-gray-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div className={`text-lg font-bold ${color}`}>{value}</div>
                        <div className="text-xs text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div className="px-5 py-3 flex flex-wrap gap-2">
                    {queue.paused ? (
                      <button
                        onClick={handleResume(queue.queueName)}
                        className="px-3 py-1.5 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                      >
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(queue.queueName)}
                        className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                      >
                        Pause
                      </button>
                    )}
                    <button
                      onClick={() => handleClear(queue.queueName, 'failed')}
                      disabled={queue.failed === 0}
                      className="px-3 py-1.5 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Clear Failed ({queue.failed})
                    </button>
                    <button
                      onClick={() => handleClear(queue.queueName, 'completed')}
                      disabled={queue.completed === 0}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Clear Done ({queue.completed})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Trends table ── */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Performance Trends</h3>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['24h', '7d', '30d'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1.5 transition-colors ${
                      trendPeriod === p
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Queue', 'Total Jobs', 'Successful', 'Failed', 'Success Rate', 'Avg Duration'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {trends.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">
                      No trend data available for this period
                    </td>
                  </tr>
                ) : trends.map(trend => (
                  <tr key={trend.queueName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getQueueLabel(trend.queueName)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{trend.total}</td>
                    <td className="px-6 py-4 text-sm text-green-700">{trend.successful}</td>
                    <td className="px-6 py-4 text-sm text-red-700">{trend.failed}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-medium ${
                        trend.successRate >= 90 ? 'text-green-700' :
                        trend.successRate >= 70 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {trend.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {trend.avgProcessingTime > 0 ? formatMs(trend.avgProcessingTime) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Confirm dialog ── */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmAction.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{confirmAction.body}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmAction.onConfirm;
                  setConfirmAction(null);
                  try {
                    await action();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Action failed', 'error');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast.show && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 max-w-md ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error'   ? 'bg-red-600 text-white' :
                                     'bg-blue-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
