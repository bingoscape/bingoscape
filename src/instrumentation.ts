import { registerOTel } from '@vercel/otel';
import { logger } from "@/lib/logger";

export async function register() {
  registerOTel({ serviceName: 'bingoscape-next' });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    logger.info("Initializing observability for Node.js runtime");

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
