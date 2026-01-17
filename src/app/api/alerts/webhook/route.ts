import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface AlertManagerAlert {
  status: "firing" | "resolved";
  labels: {
    alertname: string;
    severity: "critical" | "warning" | "info";
    [key: string]: string;
  };
  annotations: {
    summary?: string;
    description?: string;
    runbook_url?: string;
    [key: string]: string | undefined;
  };
  startsAt: string;
  endsAt?: string;
  generatorURL: string;
}

interface AlertManagerPayload {
  receiver: string;
  status: "firing" | "resolved";
  alerts: AlertManagerAlert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
}

/**
 * Alert webhook endpoint for Alertmanager
 * POST /api/alerts/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AlertManagerPayload;

    logger.info(
      {
        type: "alert_received",
        status: payload.status,
        alertCount: payload.alerts.length,
        groupLabels: payload.groupLabels,
      },
      `Received ${payload.alerts.length} alert(s) with status: ${payload.status}`,
    );

    // Get Discord webhook URL from environment
    const discordWebhookUrl = process.env.ALERT_DISCORD_WEBHOOK_URL;

    if (!discordWebhookUrl) {
      logger.warn(
        "Discord webhook URL not configured, skipping Discord notification",
      );
      return NextResponse.json(
        { message: "Alert received but Discord not configured" },
        { status: 200 },
      );
    }

    // Format alerts for Discord
    const embeds = payload.alerts.slice(0, 10).map((alert) => {
      // Determine color based on severity and status
      let color = 0x3498db; // Blue (info)
      if (payload.status === "resolved") {
        color = 0x2ecc71; // Green
      } else if (alert.labels.severity === "critical") {
        color = 0xe74c3c; // Red
      } else if (alert.labels.severity === "warning") {
        color = 0xf39c12; // Orange
      }

      const fields: Array<{ name: string; value: string; inline?: boolean }> =
        [];

      // Add severity
      fields.push({
        name: "🔔 Severity",
        value: alert.labels.severity.toUpperCase(),
        inline: true,
      });

      // Add status
      fields.push({
        name: "📊 Status",
        value: payload.status.toUpperCase(),
        inline: true,
      });

      // Add start time
      const startTime = new Date(alert.startsAt).toLocaleString("en-US", {
        timeZone: "UTC",
        dateStyle: "short",
        timeStyle: "short",
      });
      fields.push({
        name: "⏰ Started",
        value: startTime,
        inline: true,
      });

      // Add additional labels
      Object.entries(alert.labels).forEach(([key, value]) => {
        if (key !== "alertname" && key !== "severity") {
          fields.push({
            name: key,
            value: value,
            inline: true,
          });
        }
      });

      return {
        title: `${payload.status === "firing" ? "🚨" : "✅"} ${alert.labels.alertname}`,
        description:
          alert.annotations.description ||
          alert.annotations.summary ||
          "No description provided",
        color,
        fields,
        footer: {
          text: `Bingoscape Monitoring • ${new Date().toISOString()}`,
        },
        timestamp: new Date().toISOString(),
      };
    });

    // Send to Discord
    const discordResponse = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Bingoscape Alerts",
        embeds,
      }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      logger.error(
        {
          status: discordResponse.status,
          error: errorText,
        },
        "Failed to send alert to Discord",
      );

      return NextResponse.json(
        { error: "Failed to send Discord notification" },
        { status: 500 },
      );
    }

    logger.info("Successfully sent alert notification to Discord");

    return NextResponse.json(
      { message: "Alert processed successfully" },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ error }, "Failed to process alert webhook");

    return NextResponse.json(
      { error: "Failed to process alert" },
      { status: 500 },
    );
  }
}
