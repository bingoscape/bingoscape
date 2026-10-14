/**
 * @jest-environment node
 *
 * The participant read model against real Postgres (each test rolls back):
 * one SQL statement per page with SQL-side filtering, sorting and paging.
 */
import { getEventParticipants } from "@/app/actions/events"
import { withDb } from "@/lib/test-utils"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventBuyIns,
  eventDonations,
  eventParticipants,
  eventRegistrationRequests,
  events,
  playerMetadata,
  teamMembers,
  teams,
  users,
} from "@/server/db/schema"
import {
  escapeLike,
  getParticipantsEventInfo,
  getParticipantsOverview,
  listAllParticipants,
  listParticipants,
  listRegistrationRequests,
  paymentStatusOf,
} from "@/server/queries/participants"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (id: string) => session.mockResolvedValue({ user: { id } })

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Event with: owner (admin, no team), alice (team Alpha, paid in full, 15 in
 * donations), bob (team Beta, partial), carol (management, no team, unpaid,
 * name override), dave (no team, no buy-in row).
 */
async function seed() {
  const suffix = Math.random().toString(36).slice(2)
  const names = ["owner", "alice", "bob", "carol", "dave", "outsider"] as const
  const created = await db
    .insert(users)
    .values(
      names.map((name) => ({
        name,
        email: `${name}-${suffix}@participants-query.test`,
        runescapeName:
          name === "owner" ? "Owner" : name[0]!.toUpperCase() + name.slice(1),
      }))
    )
    .returning({ id: users.id, email: users.email })
  const id = Object.fromEntries(
    names.map((n) => [
      n,
      created.find((u) => u.email === `${n}-${suffix}@participants-query.test`)!
        .id,
    ])
  ) as Record<(typeof names)[number], string>

  const makeEvent = async (title: string, minimumBuyIn: number) => {
    const [event] = await db
      .insert(events)
      .values({
        title,
        startDate: new Date(Date.now() + DAY_MS),
        endDate: new Date(Date.now() + 2 * DAY_MS),
        creatorId: id.owner,
        minimumBuyIn,
      })
      .returning({ id: events.id })
    return event!.id
  }
  const eventId = await makeEvent("Query", 100)
  const otherEventId = await makeEvent("Other", 0)

  const participants = await db
    .insert(eventParticipants)
    .values([
      { eventId, userId: id.owner, role: "admin" as const },
      { eventId, userId: id.alice, role: "participant" as const },
      { eventId, userId: id.bob, role: "participant" as const },
      { eventId, userId: id.carol, role: "management" as const },
      { eventId, userId: id.dave, role: "participant" as const },
      { eventId: otherEventId, userId: id.owner, role: "admin" as const },
      { eventId: otherEventId, userId: id.alice, role: "participant" as const },
    ])
    .returning({
      id: eventParticipants.id,
      userId: eventParticipants.userId,
      eventId: eventParticipants.eventId,
    })
  const pid = (userId: string) =>
    participants.find((p) => p.userId === userId && p.eventId === eventId)!.id

  const [alpha, beta] = await db
    .insert(teams)
    .values([
      { eventId, name: "Alpha" },
      { eventId, name: "Beta" },
    ])
    .returning({ id: teams.id, name: teams.name })
  await db.insert(teamMembers).values([
    { teamId: alpha!.id, eventId, userId: id.alice, isLeader: false },
    { teamId: beta!.id, eventId, userId: id.bob, isLeader: false },
  ])

  await db.insert(eventBuyIns).values([
    { eventParticipantId: pid(id.alice), amount: 100, expectedAmount: 100 },
    { eventParticipantId: pid(id.bob), amount: 40, expectedAmount: 100 },
    { eventParticipantId: pid(id.carol), amount: 0 },
  ])
  await db.insert(eventDonations).values([
    { eventParticipantId: pid(id.alice), amount: 10 },
    { eventParticipantId: pid(id.alice), amount: 5 },
  ])
  await db.insert(playerMetadata).values({
    userId: id.carol,
    eventId,
    runescapeNameOverride: "Zed",
    skillLevel: "advanced",
    ehp: 100,
  })

  return { id, eventId, otherEventId, alpha: alpha!.id, beta: beta!.id }
}

const names = (rows: { runescapeName: string }[]) =>
  rows.map((r) => r.runescapeName)

describe("listParticipants", () => {
  it("returns the participant with team, payment, donations and metadata", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const page = await listParticipants(f.eventId)
      const byName = Object.fromEntries(
        page.rows.map((r) => [r.runescapeName, r])
      )

      expect(page.total).toBe(5)
      expect(byName["Alice"]).toMatchObject({
        id: f.id.alice,
        role: "participant",
        teamId: f.alpha,
        teamName: "Alpha",
        buyIn: 100,
        expectedBuyIn: 100,
        paymentStatus: "paid",
        totalDonations: 15,
        hasMetadata: false,
      })
      expect(byName["Bob"]).toMatchObject({
        teamName: "Beta",
        buyIn: 40,
        paymentStatus: "partial",
        totalDonations: 0,
      })
      // No buy-in row: owes the Event's minimum and has paid nothing.
      expect(byName["Dave"]).toMatchObject({
        buyIn: 0,
        expectedBuyIn: 100,
        paymentStatus: "unpaid",
        teamId: null,
        teamName: null,
      })
      // The override replaces the RuneScape name; the original stays available.
      expect(byName["Zed"]).toMatchObject({
        id: f.id.carol,
        role: "management",
        hasOverride: true,
        originalRunescapeName: "Carol",
        hasMetadata: true,
        skillLevel: "advanced",
        paymentStatus: "unpaid",
      })
    })
  })

  it("does not mix up Events: a participant of two Events only shows the data of the one asked for", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const other = await listAllParticipants(f.otherEventId)

      expect(other.map((p) => p.runescapeName).sort()).toEqual([
        "Alice",
        "Owner",
      ])
      // Alice has a team and a buy-in in the first Event, none here.
      expect(other.find((p) => p.id === f.id.alice)).toMatchObject({
        teamId: null,
        buyIn: 0,
        totalDonations: 0,
      })
    })
  })

  it("filters by search term on the (overridden) and the original name", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      expect(
        names((await listParticipants(f.eventId, { q: "ali" })).rows)
      ).toEqual(["Alice"])
      expect(
        names((await listParticipants(f.eventId, { q: "zed" })).rows)
      ).toEqual(["Zed"])
      expect(
        names((await listParticipants(f.eventId, { q: "carol" })).rows)
      ).toEqual(["Zed"])
    })
  })

  it("treats LIKE wildcards in the search term literally", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      expect((await listParticipants(f.eventId, { q: "%" })).total).toBe(0)
      expect((await listParticipants(f.eventId, { q: "_" })).total).toBe(0)
      expect(escapeLike("50%_\\")).toBe("50\\%\\_\\\\")
    })
  })

  it("filters by role, team and payment status", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      expect(
        names((await listParticipants(f.eventId, { role: "management" })).rows)
      ).toEqual(["Zed"])
      expect(
        names((await listParticipants(f.eventId, { team: f.alpha })).rows)
      ).toEqual(["Alice"])
      expect(
        names(
          (await listParticipants(f.eventId, { team: "none", sort: "name" }))
            .rows
        )
      ).toEqual(["Dave", "Owner", "Zed"])
      expect(
        names((await listParticipants(f.eventId, { payment: "partial" })).rows)
      ).toEqual(["Bob"])
      expect(
        names(
          (await listParticipants(f.eventId, { payment: "unpaid" })).rows
        ).sort()
      ).toEqual(["Dave", "Owner", "Zed"])
      expect(
        names((await listParticipants(f.eventId, { payment: "paid" })).rows)
      ).toEqual(["Alice"])
    })
  })

  it("returns nothing for a malformed team id instead of failing", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const page = await listParticipants(f.eventId, { team: "not-a-uuid" })

      expect(page.rows).toEqual([])
      expect(page.total).toBe(0)
    })
  })

  it("sorts by name, role, team (no team last), buy-in and status, both ways", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const sorted = async (
        sort: "name" | "role" | "team" | "buyIn" | "donations" | "status",
        dir: "asc" | "desc"
      ) => names((await listParticipants(f.eventId, { sort, dir })).rows)

      expect(await sorted("name", "asc")).toEqual([
        "Alice",
        "Bob",
        "Dave",
        "Owner",
        "Zed",
      ])
      expect(await sorted("name", "desc")).toEqual([
        "Zed",
        "Owner",
        "Dave",
        "Bob",
        "Alice",
      ])
      expect((await sorted("role", "asc")).slice(0, 2)).toEqual([
        "Owner",
        "Zed",
      ])
      expect((await sorted("team", "asc")).slice(0, 2)).toEqual([
        "Alice",
        "Bob",
      ])
      // Participants without a team stay at the end in both directions.
      expect((await sorted("team", "desc")).slice(0, 2)).toEqual([
        "Bob",
        "Alice",
      ])
      expect((await sorted("buyIn", "desc")).slice(0, 2)).toEqual([
        "Alice",
        "Bob",
      ])
      expect((await sorted("donations", "desc"))[0]).toBe("Alice")
      expect((await sorted("status", "asc"))[4]).toBe("Alice")
      expect((await sorted("status", "desc"))[0]).toBe("Alice")
      expect((await sorted("status", "desc"))[1]).toBe("Bob")
    })
  })

  it("pages with a total, clamps a page past the end and keeps the order stable", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const first = await listParticipants(f.eventId, { pageSize: 2, page: 1 })
      const second = await listParticipants(f.eventId, { pageSize: 2, page: 2 })
      const last = await listParticipants(f.eventId, { pageSize: 2, page: 3 })
      const beyond = await listParticipants(f.eventId, {
        pageSize: 2,
        page: 99,
      })

      expect([first.total, first.pageCount]).toEqual([5, 3])
      expect(names(first.rows)).toEqual(["Alice", "Bob"])
      expect(names(second.rows)).toEqual(["Dave", "Owner"])
      expect(names(last.rows)).toEqual(["Zed"])
      expect(beyond.page).toBe(3)
      expect(names(beyond.rows)).toEqual(["Zed"])
    })
  })

  it("caps the page size", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const page = await listParticipants(f.eventId, { pageSize: 100000 })

      expect(page.pageSize).toBe(100)
    })
  })

  it("is empty for someone who may not list participants", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.alice)

      expect((await listParticipants(f.eventId)).rows).toEqual([])
      expect(await listAllParticipants(f.eventId)).toEqual([])
    })
  })

  it("matches the legacy getEventParticipants action", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const legacy = await getEventParticipants(f.eventId)
      const all = await listAllParticipants(f.eventId)

      expect(legacy).toHaveLength(5)
      expect(legacy.map((p) => p.id).sort()).toEqual(
        all.map((p) => p.id).sort()
      )
      expect(legacy.find((p) => p.id === f.id.alice)).toMatchObject({
        runescapeName: "Alice",
        hasOverride: false,
        teamName: "Alpha",
        buyIn: 100,
        totalDonations: 15,
        skillLevel: null,
      })
    })
  })
})

describe("listRegistrationRequests", () => {
  it("searches every field in SQL, filters by status and names the reviewer", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const [pending, rejected] = await db
        .insert(eventRegistrationRequests)
        .values([
          {
            eventId: f.eventId,
            userId: f.id.outsider,
            status: "pending",
            message: "I play raids",
          },
          {
            eventId: f.eventId,
            userId: f.id.dave,
            status: "rejected",
            reviewedBy: f.id.owner,
          },
        ])
        .returning({ id: eventRegistrationRequests.id })

      const all = await listRegistrationRequests(f.eventId)
      expect(all).toHaveLength(2)
      expect(all[0]?.event).toEqual({ id: f.eventId, title: "Query" })

      // Email only (the name is set and does not match), then message.
      expect(
        (await listRegistrationRequests(f.eventId, { q: "outsider-" })).map(
          (r) => r.id
        )
      ).toEqual([pending!.id])
      expect(
        (await listRegistrationRequests(f.eventId, { q: "raids" })).map(
          (r) => r.id
        )
      ).toEqual([pending!.id])

      const onlyRejected = await listRegistrationRequests(f.eventId, {
        status: "rejected",
      })
      expect(onlyRejected.map((r) => r.id)).toEqual([rejected!.id])
      expect(onlyRejected[0]?.reviewer).toMatchObject({ id: f.id.owner })
      expect(all.find((r) => r.id === pending!.id)?.reviewer).toBeNull()
    })
  })

  it("is empty without the review permission", async () => {
    await withDb(async () => {
      const f = await seed()
      await db
        .insert(eventRegistrationRequests)
        .values({ eventId: f.eventId, userId: f.id.outsider })
      signInAs(f.id.alice)

      expect(await listRegistrationRequests(f.eventId)).toEqual([])
    })
  })
})

describe("getParticipantsOverview", () => {
  it("counts teams, payments, metadata coverage and registrations", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      await db.insert(eventRegistrationRequests).values([
        { eventId: f.eventId, userId: f.id.outsider, status: "pending" },
        { eventId: f.eventId, userId: f.id.dave, status: "rejected" },
      ])

      const overview = await getParticipantsOverview(f.eventId)

      expect(overview).toMatchObject({
        participants: 5,
        onTeam: 2,
        unassigned: 3,
        registrations: { pending: 1, approved: 0, rejected: 1 },
        payment: {
          paid: 1,
          partial: 1,
          unpaid: 3,
          // alice 100 + bob 100 + carol 100 (no snapshot, minimum 100) + dave 100 + owner 100
          expectedTotal: 500,
          paidTotal: 140,
          outstanding: 360,
        },
        metadata: {
          withMetadata: 1,
          coverage: 20,
          fields: { ehp: 1, ehb: 0, timezone: 0, dailyHours: 0, skillLevel: 1 },
        },
      })
    })
  })

  it("is all zero for someone who may not list participants", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.alice)

      const overview = await getParticipantsOverview(f.eventId)

      expect(overview.participants).toBe(0)
      expect(overview.payment.expectedTotal).toBe(0)
    })
  })
})

describe("getParticipantsEventInfo", () => {
  it("returns just what the participant views need", async () => {
    await withDb(async () => {
      const f = await seed()

      expect(await getParticipantsEventInfo(f.eventId)).toEqual({
        title: "Query",
        minimumBuyIn: 100,
        clanId: null,
      })
      expect(
        await getParticipantsEventInfo("00000000-0000-0000-0000-000000000000")
      ).toBeNull()
    })
  })
})

describe("paymentStatusOf", () => {
  it.each([
    [0, 100, "unpaid"],
    [40, 100, "partial"],
    [100, 100, "paid"],
    [150, 100, "paid"],
    [0, 0, "paid"],
  ] as const)("paid %p of %p is %s", (paid, expected, status) => {
    expect(paymentStatusOf(paid, expected)).toBe(status)
  })
})
