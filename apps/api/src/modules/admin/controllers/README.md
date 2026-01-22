# Job Monitoring System - Quick Start

## Files Created

### Backend (NestJS)
1. **`apps/api/src/modules/admin/controllers/job-monitoring.controller.ts`**
   - Main controller with 9 endpoints
   - SSE implementation for real-time updates
   - Queue control operations
   - Stuck job detection

2. **`apps/api/src/modules/admin/dto/job-monitoring.dto.ts`**
   - TypeScript DTOs with validation
   - OpenAPI/Swagger documentation
   - Type-safe request/response models

3. **`apps/api/src/modules/admin/admin.module.ts`** (updated)
   - Registered JobMonitoringController
   - Added BullModule imports for queue access

### Frontend (React)
1. **`apps/web/src/components/admin/JobMonitor.tsx`**
   - Comprehensive monitoring dashboard
   - Real-time SSE connection with polling fallback
   - Interactive queue controls
   - Stuck job alerts with retry functionality

2. **`apps/web/src/app/admin/jobs/page.tsx.example`**
   - Example Next.js page implementation
   - Auth integration pattern
   - Layout and navigation

### Documentation
1. **`docs/JOB_MONITORING.md`**
   - Complete API documentation
   - Architecture overview
   - Security considerations
   - Troubleshooting guide

---

## Quick Integration

### 1. Backend Setup

The controller is already integrated! Just ensure your queues are registered:

```typescript
// apps/api/src/modules/admin/admin.module.ts
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@hbcu-band-hub/shared-types';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.YOUTUBE_SYNC },
      { name: QUEUE_NAMES.VIDEO_PROCESSING },
      { name: QUEUE_NAMES.MAINTENANCE },
    ),
  ],
  // ...
})
```

### 2. Frontend Integration

Copy the example page:

```bash
cp apps/web/src/app/admin/jobs/page.tsx.example apps/web/src/app/admin/jobs/page.tsx
```

Or create your own:

```tsx
import { JobMonitor } from '@/components/admin/JobMonitor';

export default function Page() {
  return (
    <JobMonitor
      apiUrl={process.env.NEXT_PUBLIC_API_URL!}
      getAuthToken={() => yourAuthToken}
    />
  );
}
```

### 3. Test the Endpoints

```bash
# Get real-time metrics
curl http://localhost:3001/api/v1/admin/jobs/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get stuck job alerts
curl http://localhost:3001/api/v1/admin/jobs/alerts/stuck \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get trends (24h)
curl http://localhost:3001/api/v1/admin/jobs/trends?period=24h \
  -H "Authorization: Bearer YOUR_TOKEN"

# Pause a queue
curl -X PATCH http://localhost:3001/api/v1/admin/jobs/queue/youtube-sync/pause \
  -H "Authorization: Bearer YOUR_TOKEN"

# Resume a queue
curl -X PATCH http://localhost:3001/api/v1/admin/jobs/queue/youtube-sync/resume \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clear failed jobs
curl -X DELETE 'http://localhost:3001/api/v1/admin/jobs/queue/youtube-sync/clear?type=failed' \
  -H "Authorization: Bearer YOUR_TOKEN"

# Retry a job
curl -X POST http://localhost:3001/api/v1/admin/jobs/retry/youtube-sync/12345 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority": 1, "attempts": 5}'
```

### 4. Test SSE Connection

Open browser console:

```javascript
const token = 'YOUR_TOKEN';
const eventSource = new EventSource(
  `http://localhost:3001/api/v1/admin/jobs/live?authorization=${token}`
);

eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
};
```

---

## Features Overview

### ✅ Real-time Metrics
- Total job counts across all queues
- Per-queue statistics
- Success rate calculation
- Processing rate (jobs/minute)

### ✅ Server-Sent Events (SSE)
- Live updates every 2 seconds
- Automatic fallback to polling
- Low latency, efficient bandwidth

### ✅ Stuck Job Detection
- Automatic detection (>10 minutes)
- Severity levels (low/medium/high/critical)
- One-click retry functionality

### ✅ Job Trends
- Success/failure trends (24h, 7d, 30d)
- Average processing time
- Per-queue breakdown

### ✅ Queue Control
- Pause/resume queues
- Clear completed/failed jobs
- Real-time status updates

### ✅ Advanced Retry
- Retry with modified priority
- Custom retry attempts
- Backoff configuration
- Data override support

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/jobs/metrics` | GET | Real-time statistics |
| `/admin/jobs/live` | GET | SSE stream (all queues) |
| `/admin/jobs/trends` | GET | Success/failure trends |
| `/admin/jobs/alerts/stuck` | GET | Stuck job alerts |
| `/admin/jobs/queue/:name/live` | GET | SSE stream (one queue) |
| `/admin/jobs/queue/:name/pause` | PATCH | Pause queue |
| `/admin/jobs/queue/:name/resume` | PATCH | Resume queue |
| `/admin/jobs/queue/:name/clear` | DELETE | Clear jobs |
| `/admin/jobs/retry/:queue/:id` | POST | Retry with params |

---

## Security

All endpoints require:
- ✅ JWT authentication
- ✅ Role-based authorization (MODERATOR+)
- ✅ Queue control requires ADMIN+

---

## Next Steps

1. **Add to Navigation**: Link to `/admin/jobs` in your admin menu
2. **Configure Alerts**: Set up notifications for critical stuck jobs
3. **Monitor Performance**: Track success rates and processing times
4. **Tune Workers**: Adjust concurrency based on queue depth
5. **Export Metrics**: Integrate with Prometheus/Grafana

---

## Troubleshooting

### SSE Not Working?
- Check CORS configuration
- Verify JWT token format
- Try polling fallback mode

### Jobs Getting Stuck?
- Check worker logs
- Verify external service health
- Review job timeout settings
- Use retry with increased attempts

### High Queue Depth?
- Increase worker concurrency
- Add more worker instances
- Check for bottlenecks
- Review job priorities

---

## Support

For detailed documentation, see: `docs/JOB_MONITORING.md`

For API examples, see: `docs/API_EXAMPLES.md`

For architecture details, see: `docs/MONITORING_IMPLEMENTATION_SUMMARY.md`
