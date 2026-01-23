# Bingoscape Observability Stack

This directory contains the configuration files for the Grafana, Loki, Prometheus, Tempo, and Alertmanager observability stack.

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

### Tempo

- **Purpose**: Distributed tracing backend
- **Port**: 3200 (HTTP), 4317 (OTLP gRPC), 4318 (OTLP HTTP)
- **Config**: `tempo/tempo-config.yml`
- **Retention**: 30 days
- **Features**: Trace search, service graphs, span metrics

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

## 🔍 Distributed Tracing

### OpenTelemetry Integration

The application uses OpenTelemetry for distributed tracing with automatic instrumentation:

- **HTTP requests** - All incoming/outgoing HTTP calls
- **Database queries** - PostgreSQL operations via pg instrumentation
- **File system operations** - File reads/writes
- **DNS lookups** - Network resolution
- **Next.js routes** - App router pages and API routes
- **Server actions** - Next.js server actions

### Custom Tracing Utilities

Use the tracing helpers from `@/lib/tracing` for manual instrumentation:

```typescript
import {
  traceServerAction,
  traceExternalAPI,
  traceDbOperation,
  traceFileOperation,
  addSpanAttributes,
} from "@/lib/tracing"

// Trace a server action
export async function createEvent(data: EventInput) {
  return traceServerAction("createEvent", async (span) => {
    span.setAttributes({
      "event.name": data.name,
      "event.type": data.type,
    })
    const result = await db.insert(events).values(data)
    return result
  })
}

// Trace external API calls
const playerData = await traceExternalAPI(
  "fetch_osrs_player",
  "https://api.wiseoldman.net/v2/players/username/player1",
  async (span) => {
    const response = await fetch(url)
    span.setAttribute("http.status_code", response.status)
    return response.json()
  }
)

// Add attributes to current span
addSpanAttributes({
  "user.id": userId,
  "event.id": eventId,
})
```

### Trace-to-Logs Correlation

Traces are automatically linked to logs via trace ID:

```typescript
import { logger } from "@/lib/logger"
import { getTraceContext } from "@/lib/tracing"

logger.info(
  { ...getTraceContext(), userId: "123" },
  "Event created successfully"
)
```

In Grafana, clicking a trace will show related logs, and clicking a log entry will jump to the trace.

### Sampling Strategy

- **Development**: 100% sampling (trace everything)
- **Production**: 10% parent-based sampling
  - If a trace is sampled, all child spans are included
  - Configurable via `OTEL_TRACES_SAMPLER_ARG` environment variable

### Service Graph

Tempo generates a service graph showing dependencies between:

- Next.js application
- PostgreSQL database
- External APIs (WiseOldMan, Discord webhooks)
- File storage

Access via Grafana → Explore → Tempo → Service Graph tab

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

### Tempo Queries (TraceQL)

```traceql
# All traces from the application
{service.name="bingoscape-next"}

# Slow requests (>500ms)
{service.name="bingoscape-next" && duration > 500ms}

# Failed requests
{service.name="bingoscape-next" && status.code = error}

# Database operations
{service.name="bingoscape-next" && span.db.system="postgresql"}

# Specific HTTP endpoint
{service.name="bingoscape-next" && http.target="/api/events"}

# Server actions
{service.name="bingoscape-next" && span.name =~ "server_action.*"}

# External API calls
{service.name="bingoscape-next" && span.name =~ "external_api.*"}

# Traces with errors AND slow (>1s)
{service.name="bingoscape-next" && status.code = error && duration > 1s}

# Group by HTTP method and count
{service.name="bingoscape-next"} | count() by http.method
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
- **Tempo**: 30 days
- **Alertmanager**: No long-term storage needed

To manually clear:

```bash
# Stop services
docker-compose down

# Remove volumes
docker volume rm bingoscape_prometheus_data
docker volume rm bingoscape_loki_data
docker volume rm bingoscape_tempo_data

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

### Tempo Not Receiving Traces

1. Check Tempo is running and healthy:

   ```bash
   docker-compose ps tempo
   curl http://localhost:3200/ready
   ```

2. Check application is exporting traces:

   ```bash
   docker-compose logs app | grep -i "opentelemetry"
   ```

3. Verify OTLP endpoint configuration:

   ```bash
   docker-compose exec app env | grep OTEL
   ```

4. Test trace ingestion:

   ```bash
   # View recent traces in Tempo
   curl http://localhost:3200/api/search | jq
   ```

5. Check Tempo logs:

   ```bash
   docker-compose logs tempo | tail -50
   ```

### Traces Not Appearing in Grafana

1. Verify Tempo datasource is configured:
   - Grafana → Configuration → Data Sources → Tempo
   - Click "Test" button

2. Check trace-to-logs correlation:
   - Ensure `traceId` field exists in logs
   - Check derived fields configuration in Loki datasource

3. Verify traces exist in Tempo:

   ```bash
   # Search for recent traces
   curl "http://localhost:3200/api/search?limit=10" | jq
   ```

4. Check sampling rate (might be too low):
   - View `OTEL_TRACES_SAMPLER_ARG` in docker-compose.yml
   - Increase for testing (e.g., 1.0 for 100%)

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [TraceQL Query Language](https://grafana.com/docs/tempo/latest/traceql/)

## 🔐 Security Notes

- Grafana is exposed on 127.0.0.1:3001 (localhost only)
- Prometheus is exposed on 127.0.0.1:9090 (localhost only)
- Tempo is exposed on 127.0.0.1:3200/4317/4318 (localhost only)
- Use a reverse proxy (nginx) with authentication for public access
- Change default Grafana admin password immediately
- Use HTTPS in production
- Restrict Discord webhook URL access (store in .env, never commit)
