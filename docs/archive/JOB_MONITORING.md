# Job Monitoring System

Comprehensive real-time job monitoring and management system for BullMQ queues.

## Features

### Backend (NestJS)

#### 1. **GET /admin/jobs/metrics** - Real-time Job Statistics
Returns comprehensive metrics across all queues including:
- Per-queue counts (waiting, active, completed, failed, delayed)
- Total aggregated counts
- Success rate percentage (based on last 1000 jobs)
- Processing rate (jobs/minute)
- Queue pause status

**Response:**
```json
{
  "timestamp": "2026-01-22T10:30:00.000Z",
  "queues": [
    {
      "queueName": "youtube-sync",
      "waiting": 15,
      "active": 3,
      "completed": 1250,
      "failed": 42,
      "delayed": 5,
      "paused": false
    }
  ],
  "totals": {
    "waiting": 25,
    "active": 5,
    "completed": 3500,
    "failed": 98,
    "delayed": 10
  },
  "successRate": 97.29,
  "processingRate": 12.5
}
```

#### 2. **GET /admin/jobs/live** - Server-Sent Events (SSE)
WebSocket-like real-time updates pushed to clients every 2 seconds.

**Usage:**
```typescript
const eventSource = new EventSource('/api/v1/admin/jobs/live');
eventSource.onmessage = (event) => {
  const metrics = JSON.parse(event.data);
  console.log('Live metrics:', metrics);
};
```

#### 3. **GET /admin/jobs/trends** - Job Success/Failure Trends
Calculate performance trends over time periods.

**Query Parameters:**
- `period`: `24h`, `7d`, or `30d` (default: `24h`)

**Response:**
```json
[
  {
    "queueName": "youtube-sync",
    "period": "24h",
    "successful": 1208,
    "failed": 42,
    "total": 1250,
    "successRate": 96.64,
    "avgProcessingTime": 3500
  }
]
```

#### 4. **GET /admin/jobs/alerts/stuck** - Stuck Job Detection
Automatically identifies jobs stuck in active state > 10 minutes.

**Severity Levels:**
- **Low**: 10-30 minutes
- **Medium**: 30-60 minutes
- **High**: 1-2 hours
- **Critical**: > 2 hours

**Response:**
```json
[
  {
    "jobId": "12345",
    "queueName": "youtube-sync",
    "jobName": "sync-band",
    "stuckDuration": 1800000,
    "severity": "medium",
    "startedAt": "2026-01-22T10:00:00.000Z",
    "data": { "bandId": "abc123" },
    "attemptsMade": 2
  }
]
```

#### 5. **PATCH /admin/jobs/queue/:queueName/pause** - Pause Queue
Temporarily stop processing jobs in a specific queue.

**Example:**
```bash
curl -X PATCH https://api.example.com/api/v1/admin/jobs/queue/youtube-sync/pause \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 6. **PATCH /admin/jobs/queue/:queueName/resume** - Resume Queue
Resume a paused queue.

#### 7. **DELETE /admin/jobs/queue/:queueName/clear** - Clear Queue
Remove completed/failed jobs from queue.

**Query Parameters:**
- `type`: `completed`, `failed`, or `all` (default: `all`)

**Example:**
```bash
curl -X DELETE 'https://api.example.com/api/v1/admin/jobs/queue/youtube-sync/clear?type=failed' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 8. **POST /admin/jobs/retry/:queueName/:jobId** - Retry Job with Modified Parameters
Retry a failed job with custom configuration.

**Request Body:**
```json
{
  "priority": 1,
  "attempts": 5,
  "backoff": {
    "type": "exponential",
    "delay": 5000
  },
  "dataOverrides": {
    "customParam": "newValue"
  },
  "removeOriginal": true
}
```

**Response:**
```json
{
  "success": true,
  "newJobId": "67890",
  "message": "Job retried with ID 67890"
}
```

#### 9. **GET /admin/jobs/queue/:queueName/live** - Queue-Specific Live Updates
SSE stream for a single queue with active job details.

---

### Frontend (React)

#### Component: `<JobMonitor />`

Comprehensive job monitoring dashboard with:
- Real-time metrics via SSE or polling
- Stuck job alerts with retry functionality
- Per-queue statistics and controls
- Success/failure trends (24h, 7d, 30d)
- Queue pause/resume/clear operations

**Props:**
```typescript
interface JobMonitorProps {
  apiUrl: string;                    // Base API URL
  getAuthToken: () => string | null; // Auth token provider
  autoRefresh?: boolean;             // Enable polling (default: true)
  refreshInterval?: number;          // Polling interval in ms (default: 5000)
}
```

**Usage:**
```tsx
import { JobMonitor } from '@/components/admin/JobMonitor';
import { useAuth } from '@/contexts/AuthContext';

export default function JobMonitoringPage() {
  const { token } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <JobMonitor
        apiUrl={process.env.NEXT_PUBLIC_API_URL!}
        getAuthToken={() => token}
        autoRefresh={true}
        refreshInterval={5000}
      />
    </div>
  );
}
```

---

## Architecture

### Data Flow

1. **Server-Sent Events (SSE) - Primary**
   - Controller pushes updates every 2 seconds
   - Low latency, efficient bandwidth usage
   - Automatic reconnection on error
   - Falls back to polling if SSE fails

2. **Polling - Fallback**
   - HTTP requests every 5 seconds (configurable)
   - More reliable in restrictive networks
   - Higher latency than SSE

### Alert System

The stuck job detection system runs on every metrics fetch:
1. Query all active jobs from each queue
2. Check `processedOn` timestamp vs current time
3. Calculate stuck duration
4. Assign severity based on duration thresholds
5. Sort by longest stuck first
6. Display with retry action buttons

### Queue Control

Queue operations use BullMQ's built-in methods:
- **Pause**: Stops workers from processing new jobs
- **Resume**: Restarts job processing
- **Clear**: Removes jobs from queue (does not affect running jobs)

---

## Security

All endpoints require:
- JWT authentication (`JwtAuthGuard`)
- Role-based authorization (`RolesGuard`)
- Minimum role: `MODERATOR`
- Queue control operations require `ADMIN` or `SUPER_ADMIN`

---

## Performance Considerations

### Backend

- **Metrics calculation**: O(n) where n = number of queues (typically 3-5)
- **Stuck job detection**: O(m) where m = number of active jobs (typically < 100)
- **SSE overhead**: ~2KB per update, sent every 2 seconds
- **Redis queries**: Optimized with parallel `Promise.all()` calls

### Frontend

- **SSE connection**: Single persistent HTTP connection
- **Polling fallback**: 5-second intervals (configurable)
- **Auto-refresh**: Pauses when no active jobs detected
- **Memory**: ~1-2MB for typical dashboard state

---

## Monitoring Best Practices

1. **Set appropriate thresholds**
   - Alert on > 100 waiting jobs
   - Alert on success rate < 90%
   - Alert on stuck jobs > 30 minutes

2. **Regular maintenance**
   - Clear completed jobs weekly
   - Clear failed jobs after investigation
   - Monitor Redis memory usage

3. **Scaling strategies**
   - Increase worker concurrency for high queue depth
   - Add more worker instances for horizontal scaling
   - Use job priorities to handle critical tasks first

4. **Debugging stuck jobs**
   - Check job data payload
   - Review processor logs
   - Verify external service availability
   - Consider increasing timeout values

---

## API Endpoints Summary

| Method | Endpoint | Description | Min Role |
|--------|----------|-------------|----------|
| GET | `/admin/jobs/metrics` | Real-time statistics | MODERATOR |
| GET | `/admin/jobs/live` | SSE stream (all queues) | MODERATOR |
| GET | `/admin/jobs/trends?period=24h` | Success/failure trends | MODERATOR |
| GET | `/admin/jobs/alerts/stuck` | Stuck job alerts | MODERATOR |
| GET | `/admin/jobs/queue/:queueName/live` | SSE stream (one queue) | MODERATOR |
| PATCH | `/admin/jobs/queue/:queueName/pause` | Pause queue | ADMIN |
| PATCH | `/admin/jobs/queue/:queueName/resume` | Resume queue | ADMIN |
| DELETE | `/admin/jobs/queue/:queueName/clear` | Clear jobs | ADMIN |
| POST | `/admin/jobs/retry/:queueName/:jobId` | Retry with params | ADMIN |

---

## Troubleshooting

### SSE Connection Issues

**Problem**: SSE not connecting or disconnecting frequently

**Solutions:**
1. Check CORS configuration
2. Verify JWT token is valid
3. Check proxy/load balancer timeout settings
4. Fall back to polling mode

### High Memory Usage

**Problem**: Redis memory growing unbounded

**Solutions:**
1. Enable job cleanup: `removeOnComplete`, `removeOnFail`
2. Use the "Clear Queue" feature regularly
3. Reduce job retention counts
4. Monitor with Redis `INFO memory`

### Jobs Stuck Forever

**Problem**: Jobs remain in active state indefinitely

**Solutions:**
1. Check worker process health
2. Verify external service availability
3. Review job timeout configuration
4. Use "Retry with Modified Parameters" to adjust timeouts

---

## Future Enhancements

- [ ] Job execution logs viewer
- [ ] Queue performance graphs (historical)
- [ ] Automated stuck job resolution
- [ ] Email/Slack alerts for critical issues
- [ ] Queue priority visualization
- [ ] Job dependency tracking
- [ ] Batch job operations
- [ ] Export metrics to Prometheus

---

## Related Documentation

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Admin API Documentation](../API_EXAMPLES.md)
