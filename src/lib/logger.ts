import { trace } from '@opentelemetry/api'
import { exportLogEntry } from '@/lib/logs-exporter'

export interface LogContext {
  traceId?: string
  spanId?: string
  [key: string]: unknown
}

// This interface is imported by logs-exporter.ts
export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: LogContext
  error?: Error
}

class Logger {
  private getTraceContext(): Pick<LogContext, 'traceId' | 'spanId'> {
    const span = trace.getActiveSpan()
    if (!span) return {}
    const { traceId, spanId } = span.spanContext()
    return { traceId, spanId }
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    error?: Error
  ) {
    const entry: LogEntry = {
      // Use the LogEntry type
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.getTraceContext(), ...context },
      error,
    }

    if (typeof window === 'undefined') {
      exportLogEntry(entry)
    }
  }

  private _handleArgs(
    level: 'debug' | 'info' | 'warn' | 'error',
    arg1: string | LogContext,
    arg2?: unknown,
    ...args: unknown[]
  ) {
    let message = ''
    let context: LogContext = {}
    let error: Error | undefined = undefined

    if (typeof arg1 === 'string') {
      message = arg1
      if (level === 'error') {
        if (arg2 instanceof Error) {
          error = arg2
          if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
            context = args[0] as LogContext
          }
        } else if (typeof arg2 === 'object' && arg2 !== null) {
          context = arg2 as LogContext
        }
      } else {
        if (typeof arg2 === 'object' && arg2 !== null) {
          context = arg2 as LogContext
        }
      }
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      context = arg1 as LogContext
      if (typeof arg2 === 'string') {
        message = arg2
      }
      if (args.length > 0) {
        if (args[0] instanceof Error) {
          error = args[0]
        } else if (args[0] !== undefined) {
          error = new Error(String(args[0]))
        }
      }
    }

    // Make sure we have an Error instance for the entry
    if (!error && context.error instanceof Error) {
      error = context.error
    } else if (!error && context.err instanceof Error) {
      error = context.err
    } else if (!error && context.error) {
      error = new Error(String(context.error))
    } else if (!error && context.err) {
      error = new Error(String(context.err))
    }

    this.log(level, message, context, error)
  }

  // Public methods for a complete logger
  info(message: string, context?: LogContext): void;
  info(context: LogContext, message: string, ...args: unknown[]): void;
  info(arg1: string | LogContext, arg2?: unknown, ...args: unknown[]) {
    this._handleArgs('info', arg1, arg2, ...args)
  }

  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message: string, ...args: unknown[]): void;
  debug(arg1: string | LogContext, arg2?: unknown, ...args: unknown[]) {
    this._handleArgs('debug', arg1, arg2, ...args)
  }

  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message: string, ...args: unknown[]): void;
  warn(arg1: string | LogContext, arg2?: unknown, ...args: unknown[]) {
    this._handleArgs('warn', arg1, arg2, ...args)
  }

  error(message: string, error?: Error, context?: LogContext): void;
  error(context: LogContext, message: string, ...args: unknown[]): void;
  error(arg1: string | LogContext, arg2?: unknown, ...args: unknown[]) {
    this._handleArgs('error', arg1, arg2, ...args)
  }
}

export const logger = new Logger()
