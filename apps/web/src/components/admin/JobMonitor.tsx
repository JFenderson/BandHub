'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
} from 'lucide-react';

// ============ TYPES ============

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
  timestamp: Date;
  queues: QueueMetrics[];
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  successRate: number;
  processingRate: number;
}

interface JobTrend {
  queueName: string;
  period: '24h' | '7d' | '30d';
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

interface JobRetryParams {
  priority?: number;
  attempts?: number;
  backoff?: { type: 'fixed' | 'exponential'; delay: number };
  dataOverrides?: Record<string, any>;
  removeOriginal?: boolean;
}

// ============ PROPS ============

interface JobMonitorProps {
  apiUrl: string;
  getAuthToken: () => string | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ============ MAIN COMPONENT ============

export function JobMonitor({
  apiUrl,
  getAuthToken,
  autoRefresh = true,
  refreshInterval = 5000,
}: JobMonitorProps) {
  const [metrics, setMetrics] = useState<JobMetrics | null>(null);
  const [trends, setTrends] = useState<JobTrend[]>([]);
  const [alerts, setAlerts] = useState<StuckJobAlert[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useSSE, setUseSSE] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ============ FETCH METHODS ============

  const fetchMetrics = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${apiUrl}/api/v1/admin/jobs/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to load job metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async (period: '24h' | '7d' | '30d') => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${apiUrl}/api/v1/admin/jobs/trends?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error('Failed to fetch trends');

      const data = await response.json();
      setTrends(data);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/v1/admin/jobs/alerts/stuck`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  // ============ SERVER-SENT EVENTS ============

  const connectSSE = () => {
    const token = getAuthToken();
    if (!token || !useSSE) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `${apiUrl}/api/v1/admin/jobs/live?authorization=${encodeURIComponent(token)}`,
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.timestamp) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
      // Fallback to polling
      setUseSSE(false);
    };

    eventSourceRef.current = eventSource;
  };

  // ============ QUEUE CONTROL ACTIONS ============

  const pauseQueue = async (queueName: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${apiUrl}/api/v1/admin/jobs/queue/${queueName}/pause`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error('Failed to pause queue');

      await fetchMetrics();
    } catch (err) {
      console.error('Error pausing queue:', err);
      alert('Failed to pause queue');
    }
  };

  const resumeQueue = async (queueName: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${apiUrl}/api/v1/admin/jobs/queue/${queueName}/resume`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error('Failed to resume queue');

      await fetchMetrics();
    } catch (err) {
      console.error('Error resuming queue:', err);
      alert('Failed to resume queue');
    }
  };

  const clearQueue = async (queueName: string, type: 'completed' | 'failed' | 'all') => {
    if (!confirm(`Clear ${type} jobs from ${queueName}?`)) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${apiUrl}/api/v1/admin/jobs/queue/${queueName}/clear?type=${type}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error('Failed to clear queue');

      await fetchMetrics();
    } catch (err) {
      console.error('Error clearing queue:', err);
      alert('Failed to clear queue');
    }
  };

  const retryJob = async (
    queueName: string,
    jobId: string,
    params?: JobRetryParams,
  ) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${apiUrl}/api/v1/admin/jobs/retry/${queueName}/${jobId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params || {}),
        },
      );

      if (!response.ok) throw new Error('Failed to retry job');

      const result = await response.json();
      alert(`Job retried successfully! New job ID: ${result.newJobId}`);
      await fetchMetrics();
      await fetchAlerts();
    } catch (err) {
      console.error('Error retrying job:', err);
      alert('Failed to retry job');
    }
  };

  // ============ EFFECTS ============

  useEffect(() => {
    fetchMetrics();
    fetchTrends(selectedPeriod);
    fetchAlerts();

    if (useSSE) {
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [useSSE]);

  useEffect(() => {
    if (!autoRefresh || useSSE) return;

    const interval = setInterval(() => {
      fetchMetrics();
      fetchAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, useSSE]);

  useEffect(() => {
    fetchTrends(selectedPeriod);
  }, [selectedPeriod]);

  // ============ UTILITY FUNCTIONS ============

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Job Monitoring</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUseSSE(!useSSE)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              useSSE
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {useSSE ? '🔴 Live' : '⏸️ Paused'}
          </button>
          <button
            onClick={() => {
              fetchMetrics();
              fetchAlerts();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Waiting"
            value={metrics.totals.waiting}
            icon={<Clock className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="Active"
            value={metrics.totals.active}
            icon={<Activity className="w-5 h-5" />}
            color="purple"
          />
          <StatCard
            title="Completed"
            value={metrics.totals.completed}
            icon={<CheckCircle className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            title="Failed"
            value={metrics.totals.failed}
            icon={<XCircle className="w-5 h-5" />}
            color="red"
          />
          <StatCard
            title="Success Rate"
            value={`${metrics.successRate.toFixed(1)}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color={metrics.successRate >= 95 ? 'green' : 'yellow'}
          />
        </div>
      )}

      {/* Stuck Job Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Stuck Jobs ({alerts.length})
          </h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={`${alert.queueName}-${alert.jobId}`}
                className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{alert.jobId}</span>
                    <span className="text-sm font-medium">{alert.jobName}</span>
                    <span className="text-xs px-2 py-1 bg-white rounded">
                      {alert.queueName}
                    </span>
                  </div>
                  <button
                    onClick={() => retryJob(alert.queueName, alert.jobId)}
                    className="px-3 py-1 bg-white rounded hover:bg-gray-50 text-sm font-medium"
                  >
                    Retry
                  </button>
                </div>
                <div className="text-sm">
                  Stuck for <strong>{formatDuration(alert.stuckDuration)}</strong> •
                  Started {new Date(alert.startedAt).toLocaleTimeString()} •
                  Attempts: {alert.attemptsMade}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue Details */}
      {metrics && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Queue Details</h2>
          <div className="space-y-4">
            {metrics.queues.map((queue) => (
              <QueueCard
                key={queue.queueName}
                queue={queue}
                onPause={() => pauseQueue(queue.queueName)}
                onResume={() => resumeQueue(queue.queueName)}
                onClear={(type) => clearQueue(queue.queueName, type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Job Trends</h2>
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trends.map((trend) => (
            <TrendCard key={trend.queueName} trend={trend} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function QueueCard({
  queue,
  onPause,
  onResume,
  onClear,
}: {
  queue: QueueMetrics;
  onPause: () => void;
  onResume: () => void;
  onClear: (type: 'completed' | 'failed' | 'all') => void;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-lg">{queue.queueName}</h3>
          {queue.paused && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
              PAUSED
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {queue.paused ? (
            <button
              onClick={onResume}
              className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              title="Resume queue"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onPause}
              className="p-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
              title="Pause queue"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onClear('all')}
            className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            title="Clear queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-blue-600">{queue.waiting}</div>
          <div className="text-xs text-gray-600">Waiting</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600">{queue.active}</div>
          <div className="text-xs text-gray-600">Active</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{queue.completed}</div>
          <div className="text-xs text-gray-600">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{queue.failed}</div>
          <div className="text-xs text-gray-600">Failed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-600">{queue.delayed}</div>
          <div className="text-xs text-gray-600">Delayed</div>
        </div>
      </div>
    </div>
  );
}

function TrendCard({ trend }: { trend: JobTrend }) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-bold mb-3">{trend.queueName}</h4>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Success Rate:</span>
          <span
            className={`font-bold ${
              trend.successRate >= 95
                ? 'text-green-600'
                : trend.successRate >= 85
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {trend.successRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Successful:</span>
          <span className="font-medium text-green-600">{trend.successful}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Failed:</span>
          <span className="font-medium text-red-600">{trend.failed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Avg Time:</span>
          <span className="font-medium">
            {(trend.avgProcessingTime / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}
