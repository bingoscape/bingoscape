import { logger } from "@/lib/logger"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    logger.info("Initializing observability for Node.js runtime")

    // Initialize OpenTelemetry tracing (must be first!)
    const { startOpenTelemetry } = await import("@/lib/otel")
    await startOpenTelemetry()

    // Initialize metrics collection
    await import("@/lib/metrics")

    logger.info("Observability initialized successfully")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    logger.info("Initializing observability for Edge runtime")
    // Edge runtime doesn't support full OpenTelemetry SDK yet
    // Only metrics and logging available
  }
}

// Custom request error handler
export function onRequestError(error: Error, request: Request) {
  logger.error(
    {
      error,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
    },
    "Request error occurred"
  )
}
