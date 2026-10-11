/**
 * @jest-environment node
 */
import {
  categorizeEvents,
  countNeedsAttention,
  filterEventsByRole,
  parseRoleFilter,
} from "@/lib/dashboard-events"
import type { EventData } from "@/app/actions/events"

const NOW = new Date("2026-06-15T12:00:00Z")

function makeEvent(
  id: string,
  start: string,
  end: string,
  role: "admin" | "management" | "participant" = "participant",
  pending?: { registrations: number; submissions: number }
): EventData {
  return {
    totalPrizePool: 0,
    event: {
      id,
      startDate: new Date(start),
      endDate: new Date(end),
      role,
    },
    managerData: pending
      ? {
          actionItems: {
            pendingRegistrations: pending.registrations,
            pendingSubmissions: pending.submissions,
          },
          eventStats: { totalParticipants: 0, activeTeams: 0 },
        }
      : undefined,
  } as unknown as EventData
}

describe("parseRoleFilter", () => {
  it("accepts known roles and falls back to all", () => {
    expect(parseRoleFilter("admin")).toBe("admin")
    expect(parseRoleFilter("participant")).toBe("participant")
    expect(parseRoleFilter("nope")).toBe("all")
    expect(parseRoleFilter(undefined)).toBe("all")
    expect(parseRoleFilter(["admin", "participant"])).toBe("admin")
  })
})

describe("filterEventsByRole", () => {
  const events = [
    makeEvent("a", "2026-06-01", "2026-06-30", "admin"),
    makeEvent("m", "2026-06-01", "2026-06-30", "management"),
    makeEvent("p", "2026-06-01", "2026-06-30", "participant"),
  ]

  it("returns everything for all", () => {
    expect(filterEventsByRole(events, "all")).toHaveLength(3)
  })

  it("treats admin and management as events the user runs", () => {
    expect(filterEventsByRole(events, "admin").map((e) => e.event.id)).toEqual([
      "a",
      "m",
    ])
  })

  it("returns only participant events for participant", () => {
    expect(
      filterEventsByRole(events, "participant").map((e) => e.event.id)
    ).toEqual(["p"])
  })
})

describe("categorizeEvents", () => {
  it("splits live, upcoming and past, treating start and end as live", () => {
    const result = categorizeEvents(
      [
        makeEvent("starts-now", "2026-06-15T12:00:00Z", "2026-06-20"),
        makeEvent("ends-now", "2026-06-01", "2026-06-15T12:00:00Z"),
        makeEvent("future", "2026-07-01", "2026-07-10"),
        makeEvent("old", "2026-01-01", "2026-01-10"),
      ],
      NOW
    )
    expect(result.active.map((e) => e.event.id).sort()).toEqual([
      "ends-now",
      "starts-now",
    ])
    expect(result.upcoming.map((e) => e.event.id)).toEqual(["future"])
    expect(result.past.map((e) => e.event.id)).toEqual(["old"])
  })

  it("orders live by soonest end, upcoming by soonest start, past by latest end", () => {
    const result = categorizeEvents(
      [
        makeEvent("live-late", "2026-06-01", "2026-06-30"),
        makeEvent("live-soon", "2026-06-01", "2026-06-16"),
        makeEvent("up-late", "2026-08-01", "2026-08-05"),
        makeEvent("up-soon", "2026-07-01", "2026-07-05"),
        makeEvent("past-old", "2026-01-01", "2026-01-05"),
        makeEvent("past-new", "2026-05-01", "2026-05-05"),
      ],
      NOW
    )
    expect(result.active.map((e) => e.event.id)).toEqual([
      "live-soon",
      "live-late",
    ])
    expect(result.upcoming.map((e) => e.event.id)).toEqual([
      "up-soon",
      "up-late",
    ])
    expect(result.past.map((e) => e.event.id)).toEqual(["past-new", "past-old"])
  })
})

describe("countNeedsAttention", () => {
  it("sums pending registrations and submissions across managed events", () => {
    const events = [
      makeEvent("a", "2026-06-01", "2026-06-30", "admin", {
        registrations: 2,
        submissions: 3,
      }),
      makeEvent("b", "2026-06-01", "2026-06-30", "participant"),
      makeEvent("c", "2026-06-01", "2026-06-30", "admin", {
        registrations: 0,
        submissions: 1,
      }),
    ]
    expect(countNeedsAttention(events)).toBe(6)
  })
})
