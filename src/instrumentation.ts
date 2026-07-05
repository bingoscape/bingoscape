import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { logger } from "@/lib/logger";
import { initializeLogsExporter } from "@/lib/logs-exporter";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export async function register() {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || (otelEndpoint ? `${otelEndpoint}/v1/traces` : undefined);

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'bingoscape-next',
    traceExporter: tracesEndpoint ? new OTLPHttpJsonTraceExporter({
      url: tracesEndpoint,
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }) : undefined,
  });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    logger.info("Initializing observability for Node.js runtime");

    // Initialize logs exporter
    initializeLogsExporter();

    // Initialize metrics collection
    await import("@/lib/metrics");

    logger.info("Observability initialized successfully");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    logger.info("Initializing observability for Edge runtime");
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
    "Request error occurred",
  );
}
