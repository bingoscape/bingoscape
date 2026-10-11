import { formatInTimeZone } from "date-fns-tz"

import type { EventState } from "@/lib/event-time"

export function plural(count: number, singular: string, pluralForm?: string) {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`
}

export interface UserRef {
  id: string
  name: string | null
  runescapeName: string | null
}

export interface SelectOption {
  value: string
  label: string
  hint?: string
}

/** Text an admin types to confirm deleting a user: their name, else RSN, else short id. */
export function userConfirmText(user: UserRef): string {
  return user.name?.trim() || user.runescapeName?.trim() || user.id.slice(0, 8)
}

/** Human label for a user without falling back to their email address. */
export function userLabel(user: UserRef): string {
  return (
    user.name?.trim() ||
    user.runescapeName?.trim() ||
    `Unnamed user (${user.id.slice(0, 8)})`
  )
}

/** Up to two uppercase initials; deterministic, no randomness. */
export function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p.charAt(0))
  return (letters.join("") || "?").toUpperCase()
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/** Date-only, always UTC so server and viewer agree. */
export function formatDate(date: Date | string): string {
  return DATE_FORMAT.format(new Date(date))
}

/** Returns the input when it is a valid IANA zone, otherwise UTC. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC"
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone })
    return timeZone
  } catch {
    return "UTC"
  }
}

/** Date in the event's own timezone, e.g. "11 Oct 2026". */
export function formatEventDate(date: Date, timeZone: string): string {
  return formatInTimeZone(date, safeTimeZone(timeZone), "d MMM yyyy")
}

/** Date and time in the event's own timezone, e.g. "11 Oct 2026, 18:00". */
export function formatEventDateTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, safeTimeZone(timeZone), "d MMM yyyy, HH:mm")
}

export function getEventState(start: Date, end: Date, now: Date): EventState {
  if (now < start) return "upcoming"
  if (now > end) return "past"
  return "active"
}

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  active: "Live",
  upcoming: "Upcoming",
  past: "Ended",
}
