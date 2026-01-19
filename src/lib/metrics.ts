import promClient from "prom-client";

// Create a Registry
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: "nodejs_",
});

// ==============================================
// HTTP Request Metrics
// ==============================================

export const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5], // 1ms to 5s
  registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

// ==============================================
// Business Metrics
// ==============================================

export const eventsCreated = new promClient.Counter({
  name: "bingoscape_events_created_total",
  help: "Total number of bingo events created",
  registers: [register],
});

export const bingosCompleted = new promClient.Counter({
  name: "bingoscape_bingos_completed_total",
  help: "Total number of bingos completed",
  registers: [register],
});

export const tileSubmissions = new promClient.Counter({
  name: "bingoscape_tile_submissions_total",
  help: "Total number of tile submissions",
  labelNames: ["status"] as const, // approved, rejected, pending
  registers: [register],
});

export const buyInsTotal = new promClient.Counter({
  name: "bingoscape_buy_ins_total",
  help: "Total number of buy-in transactions",
  registers: [register],
});

export const activeUsers = new promClient.Gauge({
  name: "bingoscape_active_users",
  help: "Number of active users (last 15 minutes)",
  registers: [register],
});

// ==============================================
// Database Metrics
// ==============================================

export const dbQueryDuration = new promClient.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query execution time",
  labelNames: ["operation"] as const, // select, insert, update, delete
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 1ms to 1s
  registers: [register],
});

export const dbQueriesTotal = new promClient.Counter({
  name: "db_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation"] as const,
  registers: [register],
});

export const dbConnectionsActive = new promClient.Gauge({
  name: "db_connections_active",
  help: "Number of active database connections",
  registers: [register],
});

// ==============================================
// Error Metrics
// ==============================================

export const errorsTotal = new promClient.Counter({
  name: "bingoscape_errors_total",
  help: "Total number of application errors",
  labelNames: ["type", "endpoint"] as const, // type: validation, database, auth, external
  registers: [register],
});

export const clientErrorsTotal = new promClient.Counter({
  name: "bingoscape_client_errors_total",
  help: "Total number of client-side JavaScript errors",
  labelNames: ["error_type"] as const,
  registers: [register],
});

// ==============================================
// Helper Functions
// ==============================================

/**
 * Normalize route path by removing IDs and dynamic segments
 * e.g., /api/events/123 -> /api/events/:id
 */
export function normalizeRoute(path: string): string {
  return (
    path
      // Replace UUIDs and nanoid patterns
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/:id",
      )
      .replace(/\/[a-zA-Z0-9_-]{21}/g, "/:id")
      // Replace numeric IDs
      .replace(/\/\d+/g, "/:id")
      // Replace username patterns
      .replace(/\/[a-zA-Z0-9_-]+(?=\/|$)/g, (match, offset, string) => {
        // Don't replace known static segments
        const staticSegments = [
          "api",
          "events",
          "bingos",
          "tiles",
          "submissions",
          "users",
          "admin",
        ];
        const segment = match.slice(1); // Remove leading slash
        if (staticSegments.includes(segment)) {
          return match;
        }
        return "/:param";
      })
  );
}

/**
 * Track HTTP request metrics
 */
export function trackHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
) {
  const route = normalizeRoute(path);
  const durationSeconds = durationMs / 1000;

  httpRequestDuration.observe(
    { method, route, status_code: statusCode.toString() },
    durationSeconds,
  );

  httpRequestsTotal.inc({
    method,
    route,
    status_code: statusCode.toString(),
  });
}

/**
 * Track database query metrics
 */
export function trackDbQuery(
  operation: "select" | "insert" | "update" | "delete",
  durationMs: number,
) {
  const durationSeconds = durationMs / 1000;

  dbQueryDuration.observe({ operation }, durationSeconds);
  dbQueriesTotal.inc({ operation });
}

/**
 * Track error occurrence
 */
export function trackError(
  type: "validation" | "database" | "auth" | "external" | "unknown",
  endpoint?: string,
) {
  errorsTotal.inc({
    type,
    endpoint: endpoint ? normalizeRoute(endpoint) : "unknown",
  });
}

/**
 * Update active users count
 */
export function updateActiveUsers(count: number) {
  activeUsers.set(count);
}

/**
 * Export metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

// Export the registry
export default register;
