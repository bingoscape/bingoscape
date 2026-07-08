"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import {
  events,
  clanMembers,
  eventParticipants,
  eventBuyIns,
  eventDonations,
} from "@/server/db/schema"
import { and, eq, sql, inArray } from "drizzle-orm"
import type { EventData } from "../events"

const schema = z.object({
  clanId: z.string(),
})

export const getClanEvents = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { clanId }, ctx: { user } }) => {
    try {
      const userMembership = await db.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, clanId),
          eq(clanMembers.userId, user.id)
        ),
      })

      if (!userMembership) {
        return {
          success: false as const,
          error: "You are not a member of this clan",
        }
      }

      const clanEvents = await db.query.events.findMany({
        where: eq(events.clanId, clanId),
        with: {
          creator: true,
          eventParticipants: true,
          clan: true,
        },
        orderBy: (events, { desc }) => [desc(events.startDate)],
      })

      if (clanEvents.length === 0) return { success: true as const, events: [] }

      const eventIds = clanEvents.map((e) => e.id)

      const buyInsResult = await db
        .select({
          eventId: eventParticipants.eventId,
          total: sql<number>`COALESCE(SUM(${eventBuyIns.amount}), 0)`.mapWith(
            Number
          ),
        })
        .from(eventBuyIns)
        .innerJoin(
          eventParticipants,
          eq(eventBuyIns.eventParticipantId, eventParticipants.id)
        )
        .where(inArray(eventParticipants.eventId, eventIds))
        .groupBy(eventParticipants.eventId)

      const donationsResult = await db
        .select({
          eventId: eventParticipants.eventId,
          total:
            sql<number>`COALESCE(SUM(${eventDonations.amount}), 0)`.mapWith(
              Number
            ),
        })
        .from(eventDonations)
        .innerJoin(
          eventParticipants,
          eq(eventDonations.eventParticipantId, eventParticipants.id)
        )
        .where(inArray(eventParticipants.eventId, eventIds))
        .groupBy(eventParticipants.eventId)

      const buyInsMap = new Map(buyInsResult.map((r) => [r.eventId, r.total]))
      const donationsMap = new Map(
        donationsResult.map((r) => [r.eventId, r.total])
      )

      const eventData: EventData[] = clanEvents.map((event) => {
        const totalBuyIns = buyInsMap.get(event.id) ?? 0
        const totalDonations = donationsMap.get(event.id) ?? 0
        const totalPrizePool =
          event.basePrizePool + totalBuyIns + totalDonations

        return {
          event: {
            ...event,
            role: (event.creatorId === user.id
              ? "admin"
              : "participant") as import("../events").EventRole,
          },
          totalPrizePool,
        }
      })

      return { success: true as const, events: eventData }
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : "Failed to get clan events",
      }
    }
  })
