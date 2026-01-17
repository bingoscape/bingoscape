"use server"

import { getServerAuthSession } from "@/server/auth"
import { logger } from "@/lib/logger";
import { db } from "@/server/db"
import { discordWebhooks, eventParticipants, events } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { testDiscordWebhook } from "@/lib/discord-webhook"

export interface DiscordWebhook {
  id: string
  eventId: string
  name: string
  webhookUrl: string
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export async function getDiscordWebhooks(eventId: string): Promise<DiscordWebhook[]> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error("Not authenticated")
  }

  // Check if user has permission to view webhooks for this event
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      eventParticipants: {
        where: eq(eventParticipants.userId, session.user.id)
      }
    }
  })

  if (!event) {
    throw new Error("Event not found")
  }

  const userParticipant = event.eventParticipants[0]
  const hasPermission = event.creatorId === session.user.id ||
    userParticipant?.role === "admin" ||
    userParticipant?.role === "management"

  if (!hasPermission) {
    throw new Error("Insufficient permissions")
  }

  const webhooks = await db.query.discordWebhooks.findMany({
    where: eq(discordWebhooks.eventId, eventId),
    orderBy: [discordWebhooks.createdAt]
  })

  return webhooks
}

export async function createDiscordWebhook(
  eventId: string,
  name: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string; webhook?: DiscordWebhook }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Validate webhook URL format
    if (!webhookUrl.includes('discord.com/api/webhooks/')) {
      return { success: false, error: "Invalid Discord webhook URL" }
    }

    // Test the webhook first
    const testResult = await testDiscordWebhook(webhookUrl)
    if (!testResult) {
      return { success: false, error: `Webhook test failed` }
    }

    // Check permissions
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, session.user.id)
        }
      }
    })

    if (!event) {
      return { success: false, error: "Event not found" }
    }

    const userParticipant = event.eventParticipants[0]
    const hasPermission = event.creatorId === session.user.id ||
      userParticipant?.role === "admin" ||
      userParticipant?.role === "management"

    if (!hasPermission) {
      return { success: false, error: "Insufficient permissions" }
    }

    // Create the webhook
    const [webhook] = await db.insert(discordWebhooks).values({
      eventId,
      name,
      webhookUrl,
      createdBy: session.user.id,
      isActive: true
    }).returning()

    revalidatePath(`/events/${eventId}`)

    return { success: true, webhook: webhook! }
  } catch (error) {
    logger.error({ error }, "Error creating Discord webhook:", error)
    return { success: false, error: "Failed to create webhook" }
  }
}

export async function updateDiscordWebhook(
  webhookId: string,
  updates: { name?: string; webhookUrl?: string; isActive?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Get the webhook and check permissions
    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(discordWebhooks.id, webhookId),
      with: {
        event: {
          with: {
            eventParticipants: {
              where: eq(eventParticipants.userId, session.user.id)
            }
          }
        }
      }
    })

    if (!webhook) {
      return { success: false, error: "Webhook not found" }
    }

    const userParticipant = webhook.event.eventParticipants[0]
    const hasPermission = webhook.event.creatorId === session.user.id ||
      userParticipant?.role === "admin" ||
      userParticipant?.role === "management"

    if (!hasPermission) {
      return { success: false, error: "Insufficient permissions" }
    }

    // If updating webhook URL, test it first
    if (updates.webhookUrl && updates.webhookUrl !== webhook.webhookUrl) {
      if (!updates.webhookUrl.includes('discord.com/api/webhooks/')) {
        return { success: false, error: "Invalid Discord webhook URL" }
      }

      const testResult = await testDiscordWebhook(updates.webhookUrl)
      if (!testResult) {
        return { success: false, error: `Webhook test failed` }
      }
    }

    // Update the webhook
    await db.update(discordWebhooks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(discordWebhooks.id, webhookId))

    revalidatePath(`/events/${webhook.eventId}`)

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating Discord webhook:", error)
    return { success: false, error: "Failed to update webhook" }
  }
}

export async function deleteDiscordWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Get the webhook and check permissions
    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(discordWebhooks.id, webhookId),
      with: {
        event: {
          with: {
            eventParticipants: {
              where: eq(eventParticipants.userId, session.user.id)
            }
          }
        }
      }
    })

    if (!webhook) {
      return { success: false, error: "Webhook not found" }
    }

    const userParticipant = webhook.event.eventParticipants[0]
    const hasPermission = webhook.event.creatorId === session.user.id ||
      userParticipant?.role === "admin" ||
      userParticipant?.role === "management"

    if (!hasPermission) {
      return { success: false, error: "Insufficient permissions" }
    }

    // Delete the webhook
    await db.delete(discordWebhooks).where(eq(discordWebhooks.id, webhookId))

    revalidatePath(`/events/${webhook.eventId}`)

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting Discord webhook:", error)
    return { success: false, error: "Failed to delete webhook" }
  }
}

export async function testWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(discordWebhooks.id, webhookId)
    })

    if (!webhook) {
      return { success: false, error: "Webhook not found" }
    }

    return { success: await testDiscordWebhook(webhook.webhookUrl), error: "Failed to test webhook" }
  } catch (error) {
    logger.error({ error }, "Error testing webhook:", error)
    return { success: false, error: "Failed to test webhook" }
  }
}
