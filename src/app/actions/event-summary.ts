"use server"

import type { EventRole } from "@/lib/authz/roles"
import { getEventById } from "@/server/queries/events"

/** The few Event fields client pages need, without Boards, Teams or Submissions. */
export interface EventSummary {
  userRole: EventRole | null
  event: {
    id: string
    title: string
    creatorId: string | null
    clanId: string | null
    minimumBuyIn: number
  }
}

/**
 * Entry point for client components that need the Event row and the caller's
 * role. `getEventById` is a plain server query (a "use server" export is a
 * public endpoint, and its full result carries every Board and Submission); it
 * applies the read policy, so a viewer who may not see the Event gets null, and
 * a non-member gets `userRole: null`.
 */
export async function getEventSummary(
  eventId: string
): Promise<EventSummary | null> {
  const data = await getEventById(eventId)
  if (!data) return null
  const { event } = data
  return {
    userRole: data.userRole,
    event: {
      id: event.id,
      title: event.title,
      creatorId: event.creatorId,
      clanId: event.clanId,
      minimumBuyIn: event.minimumBuyIn,
    },
  }
}
