import { NextResponse } from "next/server";
import { getMetrics, getMetricsContentType } from "@/lib/metrics";

/**
 * Metrics endpoint for Prometheus scraping
 * GET /api/metrics
 */
export async function GET() {
  try {
    const metrics = await getMetrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": getMetricsContentType(),
      },
    });
  } catch (error) {
    // Don't use logger here to avoid circular dependencies
    console.error("Error generating metrics:", error);

    return NextResponse.json(
      { error: "Failed to generate metrics" },
      { status: 500 },
    );
  }
}
