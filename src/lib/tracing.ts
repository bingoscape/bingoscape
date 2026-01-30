import { registerOTel } from "@vercel/otel"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

// Determine if tracing is enabled
const isTracingEnabled = process.env.OTEL_ENABLED === "true"

if (!isTracingEnabled) {
  console.log(
    "OpenTelemetry tracing is disabled. Set OTEL_ENABLED=true to enable."
  )
} else {
  // Configure the OTLP trace exporter
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://otel-collector:4318/v1/traces",
    headers: {},
  })

  // Register OpenTelemetry with @vercel/otel
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "bingoscape",
    traceExporter,
    instrumentationConfig: {
      fetch: {
        // Propagate trace context to all URLs (can be restricted for security)
        propagateContextUrls: [/.*/],
      },
    },
  })

  console.log(
    `OpenTelemetry tracing initialized for service: ${process.env.OTEL_SERVICE_NAME || "bingoscape"}`
  )
}

// Export for potential manual span creation
export { trace, context, SpanStatusCode } from "@opentelemetry/api"
