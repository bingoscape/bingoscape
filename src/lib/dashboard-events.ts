import type { EventData } from "@/app/actions/events"
import { isManagerRole } from "@/lib/authz/roles"

export type RoleFilter = "all" | "admin" | "participant"

/**
 * The `?role=` URL tokens of the dashboard. They name a filter ("events I run"
 * / "events I play in"), not an Event role; "admin" is kept so bookmarked links
 * keep working. Who runs an Event is decided by `isManagerRole`.
 */
const ROLE_FILTERS: readonly string[] = ["all", "admin", "participant"]

/** The filter that lists the Events the user runs. */
export const RUNS_FILTER: RoleFilter = "admin"

export interface CategorizedEvents {
  active: EventData[]
  upcoming: EventData[]
  past: EventData[]
}

/** Reads the `?role=` search param; anything unknown falls back to "all". */
export function parseRoleFilter(value: string | string[] | undefined): RoleFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && ROLE_FILTERS.includes(raw) ? (raw as RoleFilter) : "all"
}

/** "admin" = events the user runs (admin or management), "participant" = events they play in. */
export function filterEventsByRole(
  events: EventData[],
  filter: RoleFilter
): EventData[] {
  if (filter === "all") return events
  return events.filter((e) => {
    const runs = isManagerRole(e.event.role)
    return filter === RUNS_FILTER ? runs : !runs
  })
}

const time = (d: Date | string) => new Date(d).getTime()

/**
 * Splits events into live / upcoming / past. Live events are ordered by what
 * ends soonest, upcoming by what starts soonest, past by most recently ended.
 */
export function categorizeEvents(
  events: EventData[],
  now: Date = new Date()
): CategorizedEvents {
  const result: CategorizedEvents = { active: [], upcoming: [], past: [] }

  for (const eventData of events) {
    const start = new Date(eventData.event.startDate)
    const end = new Date(eventData.event.endDate)
    if (now >= start && now <= end) result.active.push(eventData)
    else if (now < start) result.upcoming.push(eventData)
    else result.past.push(eventData)
  }

  result.active.sort((a, b) => time(a.event.endDate) - time(b.event.endDate))
  result.upcoming.sort(
    (a, b) => time(a.event.startDate) - time(b.event.startDate)
  )
  result.past.sort((a, b) => time(b.event.endDate) - time(a.event.endDate))

  return result
}

/** Pending join requests and submissions across the events the user manages. */
export function countNeedsAttention(events: EventData[]): number {
  return events.reduce(
    (sum, e) =>
      sum +
      (e.managerData?.actionItems.pendingRegistrations ?? 0) +
      (e.managerData?.actionItems.pendingSubmissions ?? 0),
    0
  )
}
