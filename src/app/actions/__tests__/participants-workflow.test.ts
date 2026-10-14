/**
 * @jest-environment node
 *
 * The participant workflow actions against real Postgres (each test rolls
 * back): moving a participant to "No Team", registration search, and that every
 * mutation revalidates all the views that render participant data.
 */
import { and, eq } from "drizzle-orm"

import {
  approveRegistrationRequest,
  assignParticipantToTeam,
  getRegistrationRequests,
  rejectRegistrationRequest,
  requestToJoinEvent,
  updateParticipantBuyIn,
  updateParticipantRole,
} from "@/app/actions/events"
import { withDb } from "@/lib/test-utils"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventBuyIns,
  eventParticipants,
  eventRegistrationRequests,
  events,
  teamMembers,
  teams,
  users,
} from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (id: string) => session.mockResolvedValue({ user: { id } })
const revalidatePath = jest.requireMock<{ revalidatePath: jest.Mock }>(
  "next/cache"
).revalidatePath

const DAY_MS = 24 * 60 * 60 * 1000

async function seed() {
  const suffix = Math.random().toString(36).slice(2)
  const names = ["owner", "player", "applicant"] as const
  const created = await db
    .insert(users)
    .values(
      names.map((name) => ({
        name,
        email: `${name}-${suffix}@participants.test`,
      }))
    )
    .returning({ id: users.id, email: users.email })
  const id = Object.fromEntries(
    names.map((n) => [
      n,
      created.find((u) => u.email === `${n}-${suffix}@participants.test`)!.id,
    ])
  ) as Record<(typeof names)[number], string>

  const [event] = await db
    .insert(events)
    .values({
      title: "Participants",
      startDate: new Date(Date.now() + DAY_MS),
      endDate: new Date(Date.now() + 2 * DAY_MS),
      creatorId: id.owner,
      minimumBuyIn: 100,
    })
    .returning({ id: events.id })
  const eventId = event!.id
  await db.insert(eventParticipants).values([
    { eventId, userId: id.owner, role: "admin" },
    { eventId, userId: id.player, role: "participant" },
  ])
  const [team] = await db
    .insert(teams)
    .values({ eventId, name: "Alpha" })
    .returning({ id: teams.id })
  return { id, eventId, teamId: team!.id }
}

const teamRows = (eventId: string, userId: string) =>
  db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.eventId, eventId), eq(teamMembers.userId, userId))
    )

const revalidated = () => revalidatePath.mock.calls.map(([path]) => path)

const expectAllViewsRevalidated = (eventId: string) => {
  expect(revalidated()).toEqual(
    expect.arrayContaining([
      `/events/${eventId}`,
      `/events/${eventId}/participants`,
      `/events/${eventId}/teams`,
      `/events/${eventId}/registrations`,
    ])
  )
}

beforeEach(() => revalidatePath.mockClear())

describe("assignParticipantToTeam", () => {
  it("assigns a team and then moves the participant to No Team (null)", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      expect(
        await assignParticipantToTeam(f.eventId, f.id.player, f.teamId)
      ).toEqual({ success: true })
      expect(await teamRows(f.eventId, f.id.player)).toHaveLength(1)

      expect(
        await assignParticipantToTeam(f.eventId, f.id.player, null)
      ).toEqual({ success: true })
      expect(await teamRows(f.eventId, f.id.player)).toHaveLength(0)
    })
  })

  it("revalidates the participants, teams and registrations views", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      await assignParticipantToTeam(f.eventId, f.id.player, f.teamId)

      expectAllViewsRevalidated(f.eventId)
    })
  })
})

describe("mutations revalidate every participant view", () => {
  it("updateParticipantRole", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const result = await updateParticipantRole(
        f.eventId,
        f.id.player,
        "management"
      )

      expect(result.success).toBe(true)
      expectAllViewsRevalidated(f.eventId)
    })
  })

  it("updateParticipantBuyIn", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const result = await updateParticipantBuyIn(f.eventId, f.id.player, true)

      expect(result.success).toBe(true)
      expectAllViewsRevalidated(f.eventId)
    })
  })

  it("approveRegistrationRequest and rejectRegistrationRequest", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const [approve, reject] = await db
        .insert(eventRegistrationRequests)
        .values([
          { eventId: f.eventId, userId: f.id.applicant, status: "pending" },
          { eventId: f.eventId, userId: f.id.player, status: "pending" },
        ])
        .returning({ id: eventRegistrationRequests.id })

      expect((await approveRegistrationRequest(approve!.id)).success).toBe(true)
      expectAllViewsRevalidated(f.eventId)

      revalidatePath.mockClear()
      expect((await rejectRegistrationRequest(reject!.id)).success).toBe(true)
      expectAllViewsRevalidated(f.eventId)
    })
  })
})

describe("getRegistrationRequests search", () => {
  it("finds a request by email even though the name is set and does not match", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      await db.insert(eventRegistrationRequests).values({
        eventId: f.eventId,
        userId: f.id.applicant,
        status: "pending",
        message: "hello",
      })

      const byEmail = await getRegistrationRequests(f.eventId, {
        search: "applicant-",
      })
      const byMessage = await getRegistrationRequests(f.eventId, {
        search: "hello",
      })
      const none = await getRegistrationRequests(f.eventId, {
        search: "no-such-thing",
      })

      expect(byEmail).toHaveLength(1)
      expect(byMessage).toHaveLength(1)
      expect(none).toHaveLength(0)
    })
  })
})

describe("repeated writes with the new unique indexes", () => {
  it("keeps one buy-in row per participant when the toggle is hit repeatedly (also in parallel)", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const participant = await db.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, f.eventId),
          eq(eventParticipants.userId, f.id.player)
        ),
      })

      await Promise.all([
        updateParticipantBuyIn(f.eventId, f.id.player, true),
        updateParticipantBuyIn(f.eventId, f.id.player, true),
      ])
      await updateParticipantBuyIn(f.eventId, f.id.player, false)
      await updateParticipantBuyIn(f.eventId, f.id.player, true)

      const rows = await db
        .select()
        .from(eventBuyIns)
        .where(eq(eventBuyIns.eventParticipantId, participant!.id))
      expect(rows).toHaveLength(1)
      expect(rows[0]?.amount).toBe(100)
    })
  })

  it("creates a single pending request when a user asks to join twice (also in parallel)", async () => {
    await withDb(async () => {
      const f = await seed()
      await db
        .update(events)
        .set({ requiresApproval: true })
        .where(eq(events.id, f.eventId))
      signInAs(f.id.applicant)

      await Promise.all([
        requestToJoinEvent(f.eventId, "first"),
        requestToJoinEvent(f.eventId, "second"),
      ])

      const rows = await db
        .select()
        .from(eventRegistrationRequests)
        .where(
          and(
            eq(eventRegistrationRequests.eventId, f.eventId),
            eq(eventRegistrationRequests.userId, f.id.applicant)
          )
        )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe("pending")
    })
  })
})
