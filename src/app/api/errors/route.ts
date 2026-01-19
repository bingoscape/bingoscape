import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { clientErrorsTotal } from "@/lib/metrics";

interface ClientError {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Client-side error logging endpoint
 * POST /api/errors
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClientError;

    // Validate required fields
    if (!body.message || !body.url || !body.timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: message, url, timestamp" },
        { status: 400 },
      );
    }

    // Extract error type from message
    const errorType = body.message.includes("TypeError")
      ? "TypeError"
      : body.message.includes("ReferenceError")
        ? "ReferenceError"
        : body.message.includes("SyntaxError")
          ? "SyntaxError"
          : body.message.includes("NetworkError") ||
              body.message.includes("Failed to fetch")
            ? "NetworkError"
            : "UnknownError";

    // Log the client error with structured data
    logger.error(
      {
        type: "client_error",
        error: {
          message: body.message,
          stack: body.stack,
        },
        url: body.url,
        userAgent: body.userAgent,
        userId: body.userId,
        timestamp: body.timestamp,
        metadata: body.metadata,
        errorType,
      },
      `Client error: ${body.message}`,
    );

    // Track metrics
    clientErrorsTotal.inc({ error_type: errorType });

    // Return success with no content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ error }, "Failed to log client error");

    return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
  }
}
