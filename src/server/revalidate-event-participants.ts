/**
 * Server-only revalidation helper for everything that changes who takes part in
 * an Event or how they are grouped (participants, teams, registration requests,
 * buy-ins, donations, player metadata). Not a "use server" module.
 *
 * One call covers the event page and every management view that renders the
 * participant data, so an action cannot forget one of them.
 */
import { revalidatePath } from "next/cache"

export function eventParticipantPaths(eventId: string): string[] {
  const base = `/events/${eventId}`
  return [
    base,
    `${base}/participants`,
    `${base}/teams`,
    `${base}/registrations`,
  ]
}

export function revalidateEventParticipants(eventId: string): void {
  for (const path of eventParticipantPaths(eventId)) {
    revalidatePath(path)
  }
}
