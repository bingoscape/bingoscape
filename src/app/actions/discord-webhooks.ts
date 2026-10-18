"use server"

import { logger } from "@/lib/logger"
import { getServerAuthSession } from "@/server/auth"
import {
  actionFailure,
  authorize,
  denial,
  failure,
  hasPermission,
  type ActionFailure,
  type ActionResult,
} from "@/server/authz"
import { db } from "@/server/db"
import { discordWebhooks } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { testDiscordWebhook } from "@/lib/discord-webhook"
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-url"

export interface DiscordWebhook {
  id: string
  eventId: string
  name: string
  webhookUrl: string
  isActive: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getDiscordWebhooks(
  eventId: string
): Promise<DiscordWebhook[]> {
  // Webhook URLs are secrets: managers only. Deliberate: a denial reads as an
  // empty list (see guards.ts).
  if (!(await hasPermission(eventId, "webhook:manage"))) return []

  return db.query.discordWebhooks.findMany({
    where: eq(discordWebhooks.eventId, eventId),
    orderBy: [discordWebhooks.createdAt],
  })
}

export async function createDiscordWebhook(
  eventId: string,
  name: string,
  webhookUrl: string
): Promise<ActionResult<{ webhook: DiscordWebhook }>> {
  // Check permissions before anything leaves the server
  const allowed = await authorize(eventId, "webhook:manage")
  if (!allowed.success) return denial(allowed)

  try {
    // Validate webhook URL format
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return failure("Invalid Discord webhook URL", "INVALID")
    }

    // Test the webhook
    const testResult = await testDiscordWebhook(webhookUrl)
    if (!testResult) {
      logger.warn(
        { eventId, action: "createDiscordWebhook" },
        "Webhook test failed during creation"
      )
      return failure("Webhook test failed")
    }

    // Create the webhook
    const [webhook] = await db
      .insert(discordWebhooks)
      .values({
        eventId,
        name,
        webhookUrl,
        createdBy: allowed.actor.userId,
        isActive: true,
      })
      .returning()

    revalidatePath(`/events/${eventId}`)

    logger.info(
      { eventId, webhookId: webhook!.id, action: "createDiscordWebhook" },
      "Discord webhook created successfully"
    )

    return { success: true, webhook: webhook! }
  } catch (error) {
    logger.error(
      { error, eventId, action: "createDiscordWebhook" },
      "Error creating Discord webhook"
    )
    return actionFailure(error, "Failed to create webhook")
  }
}

/**
 * Authorises `webhook:manage` for the Event that owns the webhook and loads the
 * webhook. A missing webhook is NOT_FOUND; the Event is never taken from the
 * client.
 */
async function authorizeWebhook(
  webhookId: string
): Promise<
  | { success: true; webhook: typeof discordWebhooks.$inferSelect }
  | ActionFailure
> {
  const session = await getServerAuthSession()
  if (!session?.user) return failure("Not authenticated", "UNAUTHENTICATED")

  const webhook = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.id, webhookId),
  })
  if (!webhook) return failure("Webhook not found", "NOT_FOUND")

  const allowed = await authorize(webhook.eventId, "webhook:manage")
  if (!allowed.success) return denial(allowed)
  return { success: true, webhook }
}

export async function updateDiscordWebhook(
  webhookId: string,
  updates: { name?: string; webhookUrl?: string; isActive?: boolean }
): Promise<ActionResult> {
  try {
    const checked = await authorizeWebhook(webhookId)
    if (!checked.success) return checked
    const { webhook } = checked

    // If updating webhook URL, test it first
    if (updates.webhookUrl && updates.webhookUrl !== webhook.webhookUrl) {
      if (!isDiscordWebhookUrl(updates.webhookUrl)) {
        return failure("Invalid Discord webhook URL", "INVALID")
      }

      const testResult = await testDiscordWebhook(updates.webhookUrl)
      if (!testResult) {
        logger.warn(
          { webhookId, action: "updateDiscordWebhook" },
          "Webhook test failed during update"
        )
        return failure("Webhook test failed")
      }
    }

    // Update the webhook
    await db
      .update(discordWebhooks)
      .set({
        // Explicit allowlist: the types are compile-time only, so never spread
        // client input into the update.
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.webhookUrl !== undefined
          ? { webhookUrl: updates.webhookUrl }
          : {}),
        ...(updates.isActive !== undefined
          ? { isActive: updates.isActive }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(discordWebhooks.id, webhookId))

    revalidatePath(`/events/${webhook.eventId}`)

    logger.info(
      { webhookId, eventId: webhook.eventId, action: "updateDiscordWebhook" },
      "Discord webhook updated successfully"
    )

    return { success: true }
  } catch (error) {
    logger.error(
      { error, webhookId, action: "updateDiscordWebhook" },
      "Error updating Discord webhook"
    )
    return actionFailure(error, "Failed to update webhook")
  }
}

export async function deleteDiscordWebhook(
  webhookId: string
): Promise<ActionResult> {
  try {
    const checked = await authorizeWebhook(webhookId)
    if (!checked.success) return checked
    const { webhook } = checked

    // Delete the webhook
    await db.delete(discordWebhooks).where(eq(discordWebhooks.id, webhookId))

    revalidatePath(`/events/${webhook.eventId}`)

    logger.info(
      { webhookId, eventId: webhook.eventId, action: "deleteDiscordWebhook" },
      "Discord webhook deleted successfully"
    )

    return { success: true }
  } catch (error) {
    logger.error(
      { error, webhookId, action: "deleteDiscordWebhook" },
      "Error deleting Discord webhook"
    )
    return actionFailure(error, "Failed to delete webhook")
  }
}

export async function testWebhook(webhookId: string): Promise<ActionResult> {
  try {
    const checked = await authorizeWebhook(webhookId)
    if (!checked.success) return checked

    const success = await testDiscordWebhook(checked.webhook.webhookUrl)
    if (!success) {
      logger.warn({ webhookId, action: "testWebhook" }, "Webhook test failed")
      return failure("Failed to test webhook")
    }
    logger.info({ webhookId, action: "testWebhook" }, "Webhook test succeeded")
    return { success: true }
  } catch (error) {
    logger.error(
      { error, webhookId, action: "testWebhook" },
      "Error testing webhook"
    )
    return actionFailure(error, "Failed to test webhook")
  }
}
