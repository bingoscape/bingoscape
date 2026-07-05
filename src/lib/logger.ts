import pino from "pino";
import { trace } from "@opentelemetry/api";
import { exportLogEntry } from "./logs-exporter";

export interface LogContext {
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  context: LogContext;
  error?: Error;
}

// Determine log level from environment
const logLevel =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const otelStream = {
  write(msg: string) {
    // 1. Write to stdout so Docker captures it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = typeof process !== "undefined" ? (process as any) : null;
    if (proc?.stdout?.write) {
      proc.stdout.write(msg);
    } else {
      console.log(msg);
    }
    
    // 2. Parse and send to OpenTelemetry
    try {
      const parsed = JSON.parse(msg);
      
      let level: LogEntry["level"] = "info";
      if (parsed.level === 20) level = "debug";
      if (parsed.level === 30) level = "info";
      if (parsed.level === 40) level = "warn";
      if (parsed.level >= 50) level = "error";

      exportLogEntry({
        timestamp: new Date(parsed.time || Date.now()).toISOString(),
        level,
        message: parsed.msg || "",
        context: {
           traceId: parsed.trace_id,
           spanId: parsed.span_id,
           ...parsed,
        },
        error: parsed.err || parsed.error,
      });
    } catch {
      // Ignore parse errors
    }
  }
};

const options: pino.LoggerOptions = {
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

  ...(process.env.NODE_ENV === "production"
    ? {
        formatters: {
          level: (label) => ({ level: label }),
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
};

// Create the logger instance
export const logger = process.env.NODE_ENV === "production"
  ? pino(options, otelStream)
  : pino(options);

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
