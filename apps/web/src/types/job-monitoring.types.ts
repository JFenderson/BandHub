/**
 * Shared TypeScript types for Job Monitoring
 * Can be used by both frontend and backend for type safety
 */

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobMetrics {
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

export interface JobTrend {
  queueName: string;
  period: '24h' | '7d' | '30d';
  successful: number;
  failed: number;
  total: number;
  successRate: number;
  avgProcessingTime: number;
}

export type JobSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface StuckJobAlert {
  jobId: string;
  queueName: string;
  jobName: string;
  stuckDuration: number;
  severity: JobSeverity;
  startedAt: Date | string;
  data: any;
  attemptsMade: number;
}

export interface QueueControlResponse {
  queueName: string;
  action: string;
  timestamp: Date | string;
  success: boolean;
}

export interface JobRetryParams {
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  dataOverrides?: Record<string, any>;
  removeOriginal?: boolean;
}

export interface JobRetryResponse {
  success: boolean;
  newJobId: string;
  message: string;
}

export interface QueueSnapshot {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  activeJobs: Array<{
    id: string;
    name: string;
    progress: number | object;
    processedOn: number;
    data: any;
  }>;
  timestamp: Date | string;
}

// SSE Event Types
export type SSEEventType = 'connection' | 'job-metrics' | 'queue-update' | 'error';

export interface SSEMessage<T = any> {
  data: T;
  id: string;
  type: SSEEventType;
}
