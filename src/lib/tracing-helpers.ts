import {
  trace,
  context,
  SpanStatusCode,
  type Span,
  type SpanOptions,
  type Attributes,
} from "@opentelemetry/api"

/**
 * Get the current active tracer
 */
const getTracer = () => trace.getTracer("bingoscape", "0.1.0")

/**
 * Wrap an async function with a custom span
 *
 * @param name - Name of the span (e.g., "event.create", "bingo.complete")
 * @param fn - Async function to execute within the span
 * @param attributes - Custom attributes to attach to the span
 * @returns Result of the function execution
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const tracer = getTracer()

  return await tracer.startActiveSpan(name, async (span: Span) => {
    try {
      // Add custom attributes if provided
      if (attributes) {
        span.setAttributes(attributes)
      }

      // Execute the function
      const result = await fn()

      // Mark span as successful
      span.setStatus({ code: SpanStatusCode.OK })

      return result
    } catch (error) {
      // Record error in span
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      })

      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Get the current trace ID (for log correlation)
 * Returns null if no active span
 */
export function getCurrentTraceId(): string | null {
  const span = trace.getActiveSpan()
  if (!span) return null

  const spanContext = span.spanContext()
  return spanContext.traceId || null
}

/**
 * Get the current span ID (for log correlation)
 * Returns null if no active span
 */
export function getCurrentSpanId(): string | null {
  const span = trace.getActiveSpan()
  if (!span) return null

  const spanContext = span.spanContext()
  return spanContext.spanId || null
}

/**
 * Add an event to the current span
 * Events are timestamped logs within a span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = trace.getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * Set attributes on the current active span
 */
export function setSpanAttributes(attributes: Attributes): void {
  const span = trace.getActiveSpan()
  if (span) {
    span.setAttributes(attributes)
  }
}

// ==============================================
// Business-Specific Tracing Helpers
// ==============================================

/**
 * Trace event creation with custom attributes
 */
export async function traceEventCreation<T>(
  fn: () => Promise<T>,
  userId: string,
  eventData?: { eventId?: string; eventName?: string }
): Promise<T> {
  return withSpan("bingoscape.event.create", fn, {
    "user.id": userId,
    "operation.type": "create",
    ...(eventData?.eventId && { "event.id": eventData.eventId }),
    ...(eventData?.eventName && { "event.name": eventData.eventName }),
  })
}

/**
 * Trace bingo completion
 */
export async function traceBingoCompletion<T>(
  fn: () => Promise<T>,
  data: {
    bingoId: string
    userId: string
    pattern?: string
    prizeAmount?: number
  }
): Promise<T> {
  return withSpan("bingoscape.bingo.complete", fn, {
    "bingo.id": data.bingoId,
    "user.id": data.userId,
    ...(data.pattern && { "bingo.pattern": data.pattern }),
    ...(data.prizeAmount && { "bingo.prize_amount": data.prizeAmount }),
  })
}

/**
 * Trace tile submission
 */
export async function traceTileSubmission<T>(
  fn: () => Promise<T>,
  data: {
    tileId: string
    userId: string
    status: "pending" | "approved" | "rejected"
  }
): Promise<T> {
  return withSpan("bingoscape.tile.submit", fn, {
    "tile.id": data.tileId,
    "user.id": data.userId,
    "tile.status": data.status,
  })
}

/**
 * Trace tile approval/rejection
 */
export async function traceTileReview<T>(
  fn: () => Promise<T>,
  data: {
    tileId: string
    reviewerId: string
    action: "approve" | "reject"
    reason?: string
  }
): Promise<T> {
  return withSpan("bingoscape.tile.review", fn, {
    "tile.id": data.tileId,
    "reviewer.id": data.reviewerId,
    "review.action": data.action,
    ...(data.reason && { "review.reason": data.reason }),
  })
}

/**
 * Trace buy-in transaction
 */
export async function traceBuyIn<T>(
  fn: () => Promise<T>,
  data: {
    userId: string
    eventId: string
    amount: number
  }
): Promise<T> {
  return withSpan("bingoscape.buyin.transaction", fn, {
    "user.id": data.userId,
    "event.id": data.eventId,
    "transaction.amount": data.amount,
    "transaction.type": "buyin",
  })
}

/**
 * Trace database operations
 */
export async function traceDbOperation<T>(
  fn: () => Promise<T>,
  operation: "select" | "insert" | "update" | "delete",
  table: string
): Promise<T> {
  return withSpan(`db.${operation}`, fn, {
    "db.system": "postgresql",
    "db.operation": operation,
    "db.table": table,
  })
}

/**
 * Trace external API calls
 */
export async function traceExternalApi<T>(
  fn: () => Promise<T>,
  data: {
    service: string
    endpoint: string
    method?: string
  }
): Promise<T> {
  return withSpan(`external.${data.service}`, fn, {
    "external.service": data.service,
    "external.endpoint": data.endpoint,
    "http.method": data.method || "GET",
  })
}
