# Bingoscape Observability Stack

This directory contains the configuration files for the Grafana, Loki, Prometheus, and Alertmanager observability stack.

## 📊 Components

### Prometheus

- **Purpose**: Metrics collection and storage
- **Port**: 9090
- **Config**: `prometheus/prometheus.yml`
- **UI**: http://localhost:9090

### Loki

- **Purpose**: Log aggregation and storage
- **Port**: 3100
- **Config**: `loki/loki-config.yml`
- **Retention**: 30 days

### Promtail

- **Purpose**: Log shipping from Docker containers to Loki
- **Config**: `promtail/promtail-config.yml`

### Alertmanager

- **Purpose**: Alert routing and notifications
- **Port**: 9093
- **Config**: `alertmanager/alertmanager.yml`
- **Outputs**: Discord webhook + Email (SMTP)

### Grafana

- **Purpose**: Visualization and dashboards
- **Port**: 3001
- **Login**: admin / (see GRAFANA_ADMIN_PASSWORD in .env)
- **Config**: `grafana/provisioning/`

### Supporting Services

- **postgres-exporter**: PostgreSQL metrics (port 9187)
- **node-exporter**: System metrics (port 9100, optional)

### Grafana Tempo

- **Purpose**: Distributed tracing backend
- **Port**: 3200 (HTTP API), 4317 (OTLP gRPC), 4318 (OTLP HTTP)
- **Config**: `tempo/tempo.yml`
- **Retention**: 30 days
- **Storage**: Local filesystem (Parquet format)

### OpenTelemetry Collector

- **Purpose**: Trace aggregation, processing, and tail sampling
- **Port**: 4318 (OTLP HTTP receiver), 13133 (health check)
- **Config**: `otel-collector/config.yml`
- **Features**: Batching, tail sampling, resource attribution

## 🚀 Quick Start

### 1. Configure Environment Variables

Add to your `.env` file:

```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Alerts
ALERT_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL=alerts@yoursite.com

# SMTP (optional, for email alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 2. Start the Stack

```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f grafana
```

### 3. Access Dashboards

1. Open Grafana: http://localhost:3001
2. Login with admin credentials
3. Navigate to Dashboards → Bingoscape folder

## 📈 Available Dashboards

### Application Overview

- Request rate, error rate, response time (RED metrics)
- Active users
- Top slowest endpoints
- Recent errors with logs

### Database Performance

- Query duration percentiles (p50, p95, p99)
- Connection pool usage
- Transactions and rollbacks
- Slow query log

### Business Metrics

- Events created
- Bingos completed
- Tile submissions by status
- Active users trend

### Distributed Tracing

- Trace search and filtering (TraceQL)
- Request latency percentiles (p50, p95, p99)
- Error rate gauge
- Recent logs with trace IDs for correlation

## 🔔 Alerts

Alerts are configured in `prometheus/alerts/app-alerts.yml`

### Critical Alerts

- High error rate (>5% for 5min)
- API latency p95 > 500ms
- Database connection pool > 90%
- Application down

### Warning Alerts

- Elevated error rate (>1% for 10min)
- Slow database queries (p99 > 200ms)
- High memory usage (>1.5GB)
- API latency approaching threshold (p95 > 300ms)

### Notification Channels

- Discord webhook (all alerts)
- Email (critical and warning only)

## 📝 Application Metrics

### How to Use Logger

```typescript
import { logger } from "@/lib/logger"

// Info logging
logger.info({ userId: "123", eventId: "abc" }, "Event created successfully")

// Error logging
logger.error({ error, userId: "123" }, "Failed to create event")

// With duration tracking
import { withLogging } from "@/lib/logger"

const result = await withLogging(async () => createEvent(data), {
  operation: "createEvent",
  userId: session.user.id,
})
```

### How to Track Metrics

```typescript
import { eventsCreated, trackError, trackDbQuery } from "@/lib/metrics"

// Increment counters
eventsCreated.inc()

// Track errors
trackError("validation", "/api/events")

// Track database queries
const start = Date.now()
await db.query(/* ... */)
trackDbQuery("select", Date.now() - start)
```

### Client-Side Error Tracking

Errors are automatically tracked via:

1. Error Boundary (React component errors)
2. Global error handlers (unhandled errors and promise rejections)

No manual tracking needed!

## 🔍 Querying

### Prometheus Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active users
bingoscape_active_users
```

### Loki Queries (LogQL)

```logql
# All application logs
{container_name="bingoscape-app"}

# Errors only
{container_name="bingoscape-app"} |= "error"

# Specific user activity
{container_name="bingoscape-app"} | json | userId="123"

# Slow queries (>50ms)
{container_name="bingoscape-app"} | json | duration > 50
```

## 🛠️ Maintenance

### Checking Prometheus Targets

```bash
# View in browser
open http://localhost:9090/targets

# Or via CLI
curl http://localhost:9090/api/v1/targets | jq
```

### Viewing Loki Logs

```bash
# Query via API
curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={container_name="bingoscape-app"}' \
  | jq
```

### Backing Up Data

```bash
# Prometheus data
docker cp bingoscape-prometheus:/prometheus ./backup/prometheus

# Grafana dashboards
docker cp bingoscape-grafana:/var/lib/grafana ./backup/grafana

# Loki logs
docker cp bingoscape-loki:/loki ./backup/loki
```

### Cleaning Up Old Data

Data is automatically retained according to:

- **Prometheus**: 30 days
- **Loki**: 30 days (debug logs: 24h)
- **Alertmanager**: No long-term storage needed

To manually clear:

```bash
# Stop services
docker-compose down

# Remove volumes
docker volume rm bingoscape_prometheus_data
docker volume rm bingoscape_loki_data

# Restart
docker-compose up -d
```

## 🐛 Troubleshooting

### Prometheus Not Scraping Metrics

1. Check if app is exposing /api/metrics:

   ```bash
   curl http://localhost:3000/api/metrics
   ```

2. Check Prometheus targets:

   ```bash
   open http://localhost:9090/targets
   ```

3. View Prometheus logs:
   ```bash
   docker-compose logs prometheus
   ```

### Loki Not Receiving Logs

1. Check Promtail is running:

   ```bash
   docker-compose ps promtail
   ```

2. View Promtail logs:

   ```bash
   docker-compose logs promtail
   ```

3. Check Loki is healthy:
   ```bash
   curl http://localhost:3100/ready
   ```

### Alerts Not Firing

1. Check alert rules are loaded:

   ```bash
   open http://localhost:9090/alerts
   ```

2. Test Alertmanager webhook:

   ```bash
   curl -X POST http://localhost:3000/api/alerts/webhook \
     -H "Content-Type: application/json" \
     -d '{"alerts":[{"status":"firing","labels":{"alertname":"Test","severity":"info"},"annotations":{"summary":"Test alert"}}],"status":"firing"}'
   ```

3. View Alertmanager logs:
   ```bash
   docker-compose logs alertmanager
   ```

### Grafana Dashboards Not Loading

1. Check datasource configuration:

   ```bash
   docker-compose logs grafana | grep -i datasource
   ```

2. Reload provisioning:

   ```bash
   docker-compose restart grafana
   ```

3. Manually test datasources in Grafana UI:
   - Settings → Data Sources → Test

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

---

## 🔍 Distributed Tracing with Tempo

### Overview

Distributed tracing allows you to follow a single request as it flows through your entire application stack. This is invaluable for:

- **Performance Debugging**: Identify slow database queries, API calls, or rendering operations
- **Error Investigation**: See the exact sequence of operations that led to an error
- **Request Flow Visualization**: Understand how different parts of your application interact
- **Log Correlation**: Jump from a log entry directly to its complete trace

### Architecture

```
Next.js App (@vercel/otel)
         ↓
   OTel Collector (Tail Sampling)
         ↓
   Grafana Tempo (Storage)
         ↓
   Grafana (Visualization)
```

### Key Features

#### 1. Automatic Instrumentation

The Next.js application is automatically instrumented to capture:

- HTTP requests and responses
- Database queries (via Drizzle ORM)
- External API calls (fetch, axios)
- Server-side rendering operations
- API route executions

#### 2. Manual Spans for Business Operations

Critical business operations are wrapped with custom spans:

- **Event Creation**: `bingoscape.event.create`
- **Bingo Completion**: `bingoscape.bingo.complete`
- **Tile Submission**: `bingoscape.tile.submit`
- **Buy-In Transactions**: `bingoscape.buyin.transaction`

#### 3. Log-Trace Correlation

Every log entry automatically includes:

- `trace_id`: Links to the complete trace in Tempo
- `span_id`: Links to the specific operation within the trace
- Click the trace ID in Loki logs → jump directly to the trace in Tempo

#### 4. Tail Sampling Strategy

The OTel Collector uses intelligent sampling to keep costs low:

- **100% of errors**: All traces with errors are kept
- **100% of slow requests**: All requests >500ms are kept
- **100% of critical operations**: Event creation, bingo completion, buy-ins
- **1% of normal requests**: Random sample for baseline visibility (100% in development)

### Using Distributed Tracing

#### Viewing Traces in Grafana

1. Open Grafana: http://localhost:3001
2. Go to **Explore** (compass icon)
3. Select **Tempo** datasource
4. Use TraceQL queries or search by Trace ID

#### TraceQL Query Examples

```traceql
# Find all slow requests
{ span:duration > 500ms }

# Find all errors in the last hour
{ status = error }

# Find traces involving event creation
{ span.bingoscape.operation = "event.create" }

# Find traces for a specific user
{ span.user.id = "abc123" }

# Find slow database queries
{ span.db.system = "postgresql" && span:duration > 100ms }

# Complex: Find slow requests with database involvement
{ span:duration > 500ms } >> { span.db.system = "postgresql" }
```

#### Log → Trace Correlation Workflow

1. **Start in Loki**: View application logs

   ```logql
   {container_name="bingoscape-app"} | json | level="error"
   ```

2. **Find Trace ID**: Error logs include `trace_id` field

3. **Click Trace ID**: Grafana automatically creates a link to Tempo

4. **View Full Trace**: See the complete request flow, including:
   - Which API endpoint was called
   - Database queries executed
   - External API calls made
   - Where the error occurred
   - Full timing breakdown

#### Trace → Metrics Correlation

In Grafana, when viewing a trace:

- Click **"Logs for this span"** → see logs for that operation
- Click **"Metrics"** → see metrics filtered to that time range
- View **exemplars** in metric graphs → sample traces from that time period

### Adding Custom Spans to Your Code

Use the tracing helper functions in your server actions:

```typescript
import { withSpan } from "@/lib/tracing-helpers"

// Wrap any async operation with a custom span
export async function myOperation() {
  return await withSpan(
    "my.custom.operation",
    async () => {
      // Your business logic here
      const result = await db.query.users.findMany()
      return result
    },
    {
      // Custom attributes for filtering
      "user.id": userId,
      "operation.type": "query",
    }
  )
}

// Or use pre-built helpers for common operations
import { traceEventCreation } from "@/lib/tracing-helpers"

await traceEventCreation(
  async () => createEventInDatabase(data),
  session.user.id,
  { eventName: "My Event" }
)
```

### Troubleshooting Tracing Issues

#### No Traces Appearing in Tempo

1. Check if OTel is enabled:

   ```bash
   docker logs bingoscape-app | grep -i "opentelemetry"
   ```

2. Verify OTel Collector is healthy:

   ```bash
   curl http://localhost:13133
   ```

3. Check Tempo is receiving traces:

   ```bash
   curl http://localhost:3200/status/buildinfo
   ```

4. Enable debug logging:
   ```bash
   # In .env
   NEXT_OTEL_VERBOSE=1
   OTEL_LOG_LEVEL=debug
   ```

#### Broken Trace Hierarchy

If spans appear disconnected:

- Ensure all async operations use `await`
- Verify context propagation is enabled
- Check that middleware runs after OTel initialization

#### Trace IDs Not in Logs

Verify the logger mixin is working:

```typescript
// Should see trace_id and span_id in log output
logger.info({ userId: "123" }, "Test message")
```

If not present:

- Ensure `@opentelemetry/api` is imported in logger
- Verify instrumentation.ts runs before logger initialization
- Check that OTEL_ENABLED=true

### Performance Considerations

#### Storage Usage

With tail sampling at 1%:

- ~1,000 requests/hour → ~10 traces/hour retained
- Average trace size: ~50KB
- Daily storage: ~12MB/day
- 30-day retention: ~360MB total

#### Query Performance

- TraceQL queries scan Parquet blocks
- Narrow time ranges for faster queries (<1 hour recommended)
- Use specific filters: `{ span.service.name = "bingoscape" }`
- Avoid wildcards in TraceQL when possible

### Environment Configuration

```bash
# Enable tracing
OTEL_ENABLED=true

# Service identification
OTEL_SERVICE_NAME=bingoscape

# Collector endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces

# Sampling rate (1 = 1%, 100 = 100%)
TRACE_SAMPLE_RATE=1  # Production
TRACE_SAMPLE_RATE=100  # Development

# Debugging
NEXT_OTEL_VERBOSE=0  # Set to 1 for debug logs
OTEL_LOG_LEVEL=info
```

### Advanced: TraceQL Operators

| Operator | Description    | Example                                                     |
| -------- | -------------- | ----------------------------------------------------------- | ------------ | ------------------------ | --- | ------------------------ |
| `&&`     | AND condition  | `{ span:duration > 500ms && status = error }`               |
| `        |                | `                                                           | OR condition | `{ route = "/api/events" |     | route = "/api/bingos" }` |
| `>`      | Direct child   | `{ name = "HTTP GET" } > { span.db.system = "postgresql" }` |
| `>>`     | Any descendant | `{ name = "HTTP GET" } >> { span.db.operation = "SELECT" }` |
| `=`      | Exact match    | `{ span.user.id = "abc123" }`                               |
| `!=`     | Not equal      | `{ status != ok }`                                          |
| `=~`     | Regex match    | `{ route =~ "^/api/.*" }`                                   |

### Service Graph

Tempo automatically generates a service dependency graph:

1. Go to Grafana → Explore → Tempo
2. Click **"Service Graph"** tab
3. View visual map of service interactions
4. Click nodes to see request rates and error rates

---

## 🔐 Security Notes

- Grafana is exposed on 127.0.0.1:3001 (localhost only)
- Prometheus is exposed on 127.0.0.1:9090 (localhost only)
- Use a reverse proxy (nginx) with authentication for public access
- Change default Grafana admin password immediately
- Use HTTPS in production
- Restrict Discord webhook URL access (store in .env, never commit)
