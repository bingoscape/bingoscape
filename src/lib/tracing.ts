import { trace, context, SpanStatusCode, Span } from "@opentelemetry/api"
import { logger } from "@/lib/logger"

/**
 * Get the active tracer for the application
 */
export function getTracer() {
  return trace.getTracer("bingoscape-next", "0.1.0")
}

/**
 * Get the currently active span (if any)
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan()
}

/**
 * Add attributes to the currently active span
 * Useful for adding context to auto-instrumented spans
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan()
  if (span) {
    span.setAttributes(attributes)
  }
}

/**
 * Add a single attribute to the currently active span
 */
export function addSpanAttribute(
  key: string,
  value: string | number | boolean
): void {
  const span = getActiveSpan()
  if (span) {
    span.setAttribute(key, value)
  }
}

/**
 * Record an error on the currently active span
 */
export function recordSpanError(error: Error): void {
  const span = getActiveSpan()
  if (span) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  }
}

/**
 * Trace a server action with custom span
 *
 * @example
 * ```typescript
 * export async function createEvent(data: EventInput) {
 *   return traceServerAction("createEvent", async (span) => {
 *     span.setAttributes({
 *       "event.name": data.name,
 *       "event.type": data.type,
 *     });
 *
 *     const result = await db.insert(events).values(data);
 *     return result;
 *   });
 * }
 * ```
 */
export async function traceServerAction<T>(
  actionName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(
    `server_action.${actionName}`,
    {
      attributes: {
        "code.function": actionName,
        "code.namespace": "server_actions",
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          logger.error({ error, actionName }, "Server action failed")
        }
        throw error
      } finally {
        span.end()
      }
    }
  )
}

/**
 * Trace an external API call
 *
 * @example
 * ```typescript
 * const playerData = await traceExternalAPI(
 *   "fetch_osrs_player",
 *   "https://api.wiseoldman.net/v2/players/username/player1",
 *   async (span) => {
 *     const response = await fetch(url);
 *     span.setAttribute("http.status_code", response.status);
 *     return response.json();
 *   }
 * );
 * ```
 */
export async function traceExternalAPI<T>(
  operationName: string,
  url: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(
    `external_api.${operationName}`,
    {
      attributes: {
        "http.url": url,
        "http.method": "GET",
        "peer.service": new URL(url).hostname,
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          logger.error(
            { error, operationName, url },
            "External API call failed"
          )
        }
        throw error
      } finally {
        span.end()
      }
    }
  )
}

/**
 * Trace a database operation
 * Note: PostgreSQL queries are already auto-instrumented, but this can be used
 * for complex operations that span multiple queries
 *
 * @example
 * ```typescript
 * const result = await traceDbOperation(
 *   "create_event_with_tiles",
 *   "insert",
 *   async (span) => {
 *     return db.transaction(async (tx) => {
 *       const event = await tx.insert(events).values(eventData);
 *       const tiles = await tx.insert(tiles).values(tileData);
 *       span.setAttribute("tiles.count", tiles.length);
 *       return { event, tiles };
 *     });
 *   }
 * );
 * ```
 */
export async function traceDbOperation<T>(
  operationName: string,
  operation: "select" | "insert" | "update" | "delete" | "transaction",
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(
    `db.${operationName}`,
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation": operation,
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          logger.error(
            { error, operationName, operation },
            "Database operation failed"
          )
        }
        throw error
      } finally {
        span.end()
      }
    }
  )
}

/**
 * Trace file upload/processing operations
 *
 * @example
 * ```typescript
 * const uploadedPath = await traceFileOperation(
 *   "upload_event_image",
 *   async (span) => {
 *     const buffer = await file.arrayBuffer();
 *     const path = await saveImage(buffer, "events");
 *     span.setAttributes({
 *       "file.size": buffer.byteLength,
 *       "file.path": path,
 *     });
 *     return path;
 *   }
 * );
 * ```
 */
export async function traceFileOperation<T>(
  operationName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(
    `file.${operationName}`,
    {
      attributes: {
        "file.operation": operationName,
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          logger.error({ error, operationName }, "File operation failed")
        }
        throw error
      } finally {
        span.end()
      }
    }
  )
}

/**
 * Trace a generic operation with a custom span
 * Use this for any other operations that don't fit the specific helpers above
 *
 * @example
 * ```typescript
 * const report = await traceOperation(
 *   "generate_bingo_report",
 *   async (span) => {
 *     span.setAttribute("event.id", eventId);
 *     const data = await collectReportData(eventId);
 *     const report = await generatePDF(data);
 *     span.setAttribute("report.size", report.length);
 *     return report;
 *   }
 * );
 * ```
 */
export async function traceOperation<T>(
  operationName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(operationName, { attributes }, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        logger.error({ error, operationName }, "Operation failed")
      }
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Get the current trace ID (useful for logging correlation)
 */
export function getTraceId(): string | undefined {
  const span = getActiveSpan()
  if (span) {
    return span.spanContext().traceId
  }
  return undefined
}

/**
 * Get the current span ID (useful for logging correlation)
 */
export function getSpanId(): string | undefined {
  const span = getActiveSpan()
  if (span) {
    return span.spanContext().spanId
  }
  return undefined
}

/**
 * Add trace context to logger (for trace-to-logs correlation)
 *
 * @example
 * ```typescript
 * logger.info(
 *   { ...getTraceContext(), userId: "123" },
 *   "Event created successfully"
 * );
 * ```
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
  return {
    traceId: getTraceId(),
    spanId: getSpanId(),
  }
}
