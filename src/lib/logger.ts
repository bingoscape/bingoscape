import pino from "pino";
import { trace } from "@opentelemetry/api";

// Determine log level from environment
const logLevel =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const logsEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || (otelEndpoint ? `${otelEndpoint}/v1/logs` : undefined);

// Create the logger instance
export const logger = pino({
  level: logLevel,

  // Mixin to inject active trace context into every log entry
  mixin() {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        trace_flags: `0${spanContext.traceFlags.toString(16)}`,
      };
    }
    return {};
  },

  // Production with OTEL: Use OpenTelemetry transport
  // Production without OTEL: JSON for structured logging
  // Development: Pretty print for readability
  ...(process.env.NODE_ENV === "production"
    ? logsEndpoint ? {
        transport: {
          target: "pino-opentelemetry-transport",
          options: {
            loggerName: "bingoscape",
            resourceAttributes: {
              "service.name": process.env.OTEL_SERVICE_NAME || "bingoscape-next",
            },
            logRecordProcessorOptions: {
              recordProcessorType: "batch",
              exporterOptions: {
                protocol: "http",
                url: logsEndpoint,
                headers: process.env.SIGNOZ_INGESTION_KEY
                  ? { "signoz-ingestion-key": process.env.SIGNOZ_INGESTION_KEY }
                  : undefined,
              },
            },
          },
        },
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      } : {
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }),

  // Base context included in all logs
  base: {
    env: process.env.NODE_ENV,
    service: "bingoscape",
  },

  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "secret",
      "apiKey",
      "authorization",
      "*.password",
      "*.token",
      "*.secret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    remove: true,
  },

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with additional context
 * @param context - Additional context to include in all logs from this logger
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log with execution time measurement
 * @param fn - Async function to execute
 * @param context - Context for logging
 */
export async function withLogging<T>(
  fn: () => Promise<T>,
  context: {
    operation: string;
    userId?: string;
    [key: string]: unknown;
  },
): Promise<T> {
  const startTime = Date.now();
  const childLogger = logger.child(context);

  try {
    childLogger.info({ event: "start" }, `Starting ${context.operation}`);
    const result = await fn();
    const duration = Date.now() - startTime;

    childLogger.info(
      { event: "complete", duration },
      `Completed ${context.operation} in ${duration}ms`,
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    childLogger.error(
      { event: "error", error, duration },
      `Failed ${context.operation} after ${duration}ms`,
    );

    throw error;
  }
}

// Export default logger
export default logger;
