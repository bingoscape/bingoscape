import { logger } from "@/lib/logger"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    logger.info("Initializing observability for Node.js runtime")

    // Initialize OpenTelemetry tracing first (before other imports)
    if (process.env.OTEL_ENABLED === "true") {
      logger.info("Initializing OpenTelemetry tracing")
      await import("@/lib/tracing")
      logger.info("OpenTelemetry tracing initialized")
    }

    // Initialize metrics collection
    await import("@/lib/metrics")

    logger.info("Observability initialized successfully")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    logger.info("Initializing observability for Edge runtime")
    // Edge runtime has limited OTel support, use lightweight instrumentation
    if (process.env.OTEL_ENABLED === "true") {
      logger.info("Edge runtime tracing enabled")
    }
  }
}

// Custom request error handler
export function onRequestError(error: Error, request: Request) {
  // Safely extract headers - request.headers might not have .entries() in all contexts
  let headers: Record<string, string> = {}

  try {
    if (request.headers && typeof request.headers.entries === "function") {
      headers = Object.fromEntries(request.headers.entries())
    }
  } catch (e) {
    // If header extraction fails, continue without headers
    headers = { error: "Could not extract headers" }
  }

  logger.error(
    {
      error,
      url: request.url,
      method: request.method,
      headers,
    },
    "Request error occurred"
  )
}
