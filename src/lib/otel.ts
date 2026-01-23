import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"
import {
  resourceFromAttributes,
  defaultResource,
} from "@opentelemetry/resources"
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
} from "@opentelemetry/sdk-trace-node"
import { logger } from "@/lib/logger"

/**
 * Initialize OpenTelemetry SDK for distributed tracing
 * This configures:
 * - OTLP gRPC exporter for Grafana Tempo
 * - Full auto-instrumentation (HTTP, DNS, fs, pg, etc.)
 * - Smart sampling (100% dev, configurable % prod)
 * - Resource attributes (service name, version, environment)
 */
export function initializeOpenTelemetry(): NodeSDK | null {
  try {
    // Get configuration from environment variables
    const serviceName = process.env.OTEL_SERVICE_NAME ?? "bingoscape-next"
    const serviceVersion = process.env.npm_package_version ?? "0.1.0"
    const environment = process.env.NODE_ENV ?? "development"
    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317"

    // Determine sampling strategy based on environment
    const samplerType = process.env.OTEL_TRACES_SAMPLER ?? "always_on"
    const samplerArg = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? "0.1")

    let sampler
    if (environment === "development" || samplerType === "always_on") {
      // Development: trace everything
      sampler = new AlwaysOnSampler()
      logger.info("OpenTelemetry: Using AlwaysOnSampler (100% sampling)")
    } else {
      // Production: parent-based sampling with ratio
      sampler = new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(samplerArg),
      })
      logger.info(
        `OpenTelemetry: Using ParentBasedSampler with ${samplerArg * 100}% sampling`
      )
    }

    // Configure resource attributes for service identification
    const resource = defaultResource().merge(
      resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      })
    )

    // Configure OTLP exporter for Grafana Tempo
    const traceExporter = new OTLPTraceExporter({
      url: otlpEndpoint,
    })

    // Initialize NodeSDK with full auto-instrumentation
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      sampler,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Configure specific instrumentations
          "@opentelemetry/instrumentation-fs": {
            enabled: true,
          },
          "@opentelemetry/instrumentation-http": {
            enabled: true,
            // Ignore health check endpoints to reduce noise
            ignoreIncomingRequestHook: (req) => {
              const ignorePaths = [
                "/api/health",
                "/api/uptime",
                "/api/metrics",
                "/_next/static",
                "/favicon.ico",
              ]
              return ignorePaths.some((path) => req.url?.startsWith(path))
            },
          },
          "@opentelemetry/instrumentation-pg": {
            enabled: true,
            // Capture query parameters for debugging (sanitize in production)
            enhancedDatabaseReporting: environment === "development",
          },
          "@opentelemetry/instrumentation-dns": {
            enabled: true,
          },
          "@opentelemetry/instrumentation-net": {
            enabled: true,
          },
        }),
      ],
    })

    logger.info({
      serviceName,
      serviceVersion,
      environment,
      otlpEndpoint,
      msg: "OpenTelemetry SDK initialized successfully",
    })

    return sdk
  } catch (error) {
    logger.error(
      { error },
      "Failed to initialize OpenTelemetry SDK - tracing will be disabled"
    )
    return null
  }
}

/**
 * Start OpenTelemetry SDK
 * This should be called once at application startup
 */
export async function startOpenTelemetry(): Promise<void> {
  const sdk = initializeOpenTelemetry()

  if (sdk) {
    try {
      await sdk.start()
      logger.info("OpenTelemetry SDK started successfully")

      // Graceful shutdown on process termination
      process.on("SIGTERM", async () => {
        try {
          await sdk.shutdown()
          logger.info("OpenTelemetry SDK shut down successfully")
        } catch (error) {
          logger.error({ error }, "Error shutting down OpenTelemetry SDK")
        }
      })
    } catch (error) {
      logger.error({ error }, "Failed to start OpenTelemetry SDK")
    }
  }
}
