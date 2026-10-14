/**
 * @jest-environment node
 *
 * The Event actions that change memberships, against real Postgres (each test
 * rolls back): owner-only operations, ownership transfer, and that joining,
 * creating, approving and removing leave a ledger row through the helper.
 */
import { expectFailure } from "@/server/__tests__/helpers/expect-failure"
import { and, eq } from "drizzle-orm"

import {
  approveRegistrationRequest,
  createEvent,
  deleteEventByAdmin,
  joinEvent,
  removeParticipantFromEvent,
  transferEventOwnership,
  updateParticipantRole,
} from "@/app/actions/events"
import { withDb } from "@/lib/test-utils"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventParticipants,
  eventRegistrationRequests,
  events,
  roleChangeLog,
  users,
} from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (id: string | null) =>
  session.mockResolvedValue(id ? { user: { id } } : null)

const DAY_MS = 24 * 60 * 60 * 1000

async function seed() {
  const suffix = Math.random().toString(36).slice(2)
  const names = ["owner", "admin", "manager", "player", "outsider"] as const
  const created = await db
    .insert(users)
    .values(
      names.map((name) => ({ name, email: `${name}-${suffix}@events.test` }))
    )
    .returning({ id: users.id, email: users.email })
  const id = Object.fromEntries(
    names.map((n) => [
      n,
      created.find((u) => u.email === `${n}-${suffix}@events.test`)!.id,
    ])
  ) as Record<(typeof names)[number], string>

  const [event] = await db
    .insert(events)
    .values({
      title: "Membership",
      startDate: new Date(Date.now() + DAY_MS),
      endDate: new Date(Date.now() + 2 * DAY_MS),
      creatorId: id.owner,
    })
    .returning({ id: events.id })
  await db.insert(eventParticipants).values([
    { eventId: event!.id, userId: id.owner, role: "admin" },
    { eventId: event!.id, userId: id.admin, role: "admin" },
    { eventId: event!.id, userId: id.manager, role: "management" },
    { eventId: event!.id, userId: id.player, role: "participant" },
  ])
  return { id, eventId: event!.id }
}

const roleOf = async (eventId: string, userId: string) =>
  (
    await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, userId)
      ),
    })
  )?.role ?? null

const ledger = (eventId: string) =>
  db
    .select()
    .from(roleChangeLog)
    .where(eq(roleChangeLog.scopeId, eventId))
    .orderBy(roleChangeLog.seq)

describe("createEvent", () => {
  it("makes the creator an admin participant and logs it", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.outsider)
      const form = new FormData()
      form.set("title", "Fresh")
      form.set("basePrizePool", "0")
      form.set("minimumBuyIn", "0")
      form.set("startDate", new Date(Date.now() + DAY_MS).toISOString())
      form.set("endDate", new Date(Date.now() + 2 * DAY_MS).toISOString())
      expect(await createEvent(form)).toEqual({ success: true })

      const created = await db.query.events.findFirst({
        where: eq(events.title, "Fresh"),
      })
      expect(created?.creatorId).toBe(f.id.outsider)
      expect(await roleOf(created!.id, f.id.outsider)).toBe("admin")
      expect(await ledger(created!.id)).toMatchObject([
        {
          action: "add",
          newRole: "admin",
          subjectUserId: f.id.outsider,
          actorUserId: f.id.outsider,
          source: "system",
        },
      ])
    })
  })
})

describe("joinEvent", () => {
  it("adds the caller as participant, once", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.outsider)
      expect(await joinEvent(f.eventId)).toEqual({ success: true })
      expect(await roleOf(f.eventId, f.id.outsider)).toBe("participant")
      expect((await ledger(f.eventId)).at(-1)).toMatchObject({
        action: "add",
        newRole: "participant",
        source: "app",
      })
      expect(await joinEvent(f.eventId)).toMatchObject({ success: false })
    })
  })
})

describe("approveRegistrationRequest", () => {
  it("adds the requester as participant on behalf of the reviewer", async () => {
    await withDb(async () => {
      const f = await seed()
      const [request] = await db
        .insert(eventRegistrationRequests)
        .values({
          eventId: f.eventId,
          userId: f.id.outsider,
          status: "pending",
        })
        .returning({ id: eventRegistrationRequests.id })
      signInAs(f.id.manager)
      await approveRegistrationRequest(request!.id)
      expect(await roleOf(f.eventId, f.id.outsider)).toBe("participant")
      expect((await ledger(f.eventId)).at(-1)).toMatchObject({
        subjectUserId: f.id.outsider,
        actorUserId: f.id.manager,
        action: "add",
      })
    })
  })
})

describe("updateParticipantRole", () => {
  it("lets only the owner grant admin", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.admin)
      await expectFailure(updateParticipantRole(f.eventId, f.id.player, "admin"), /owner/i)
      expect(await roleOf(f.eventId, f.id.player)).toBe("participant")

      signInAs(f.id.owner)
      await updateParticipantRole(f.eventId, f.id.player, "admin")
      expect(await roleOf(f.eventId, f.id.player)).toBe("admin")
      expect((await ledger(f.eventId)).at(-1)).toMatchObject({
        action: "change",
        actorUserId: f.id.owner,
        newRole: "admin",
      })
    })
  })

  it("never demotes the owner", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.admin)
      await expectFailure(updateParticipantRole(f.eventId, f.id.owner, "participant"), "creator")
    })
  })
})

describe("removeParticipantFromEvent", () => {
  it("removes a participant, logs it and refuses the owner", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.manager)
      expect(await removeParticipantFromEvent(f.eventId, f.id.player)).toEqual({
        success: true,
      })
      expect(await roleOf(f.eventId, f.id.player)).toBeNull()
      expect((await ledger(f.eventId)).at(-1)).toMatchObject({
        action: "remove",
        oldRole: "participant",
        newRole: null,
        actorUserId: f.id.manager,
      })

      signInAs(f.id.admin)
      expect(
        await removeParticipantFromEvent(f.eventId, f.id.owner)
      ).toMatchObject({ success: false })
      expect(await roleOf(f.eventId, f.id.owner)).toBe("admin")
    })
  })
})

describe("transferEventOwnership", () => {
  it("is owner-only and moves the Event to a participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.admin)
      expect(
        await transferEventOwnership(f.eventId, f.id.player)
      ).toMatchObject({ success: false })

      signInAs(f.id.owner)
      expect(await transferEventOwnership(f.eventId, f.id.player)).toEqual({
        success: true,
      })
      const event = await db.query.events.findFirst({
        where: eq(events.id, f.eventId),
      })
      expect(event?.creatorId).toBe(f.id.player)
      expect(await roleOf(f.eventId, f.id.player)).toBe("admin")
      expect(await roleOf(f.eventId, f.id.owner)).toBe("admin")
    })
  })

  it("rejects anonymous callers and non-participants as the new owner", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(null)
      expect(
        await transferEventOwnership(f.eventId, f.id.player)
      ).toMatchObject({ success: false, code: "UNAUTHENTICATED" })
      signInAs(f.id.owner)
      expect(
        await transferEventOwnership(f.eventId, f.id.outsider)
      ).toMatchObject({ success: false, code: "NOT_A_MEMBER" })
    })
  })
})

describe("deleteEventByAdmin", () => {
  it("is owner-only: another admin is refused, the owner deletes", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.admin)
      expect(await deleteEventByAdmin(f.eventId)).toMatchObject({
        success: false,
        error: "Only the event owner can delete this event",
      })
      expect(
        await db.query.events.findFirst({ where: eq(events.id, f.eventId) })
      ).toBeDefined()

      signInAs(f.id.owner)
      expect(await deleteEventByAdmin(f.eventId)).toEqual({ success: true })
      expect(
        await db.query.events.findFirst({ where: eq(events.id, f.eventId) })
      ).toBeUndefined()
      expect(
        await db
          .select()
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, f.eventId))
      ).toHaveLength(0)
    })
  })

  it("lets the oldest admin delete an Event whose creator account is gone", async () => {
    await withDb(async () => {
      const f = await seed()
      await db
        .update(events)
        .set({ creatorId: null })
        .where(eq(events.id, f.eventId))
      // `owner` holds the oldest admin row (one insert statement shares a
      // timestamp, so set it explicitly).
      await db
        .update(eventParticipants)
        .set({ createdAt: new Date(Date.now() - DAY_MS) })
        .where(
          and(
            eq(eventParticipants.eventId, f.eventId),
            eq(eventParticipants.userId, f.id.owner)
          )
        )
      signInAs(f.id.admin)
      expect(await deleteEventByAdmin(f.eventId)).toMatchObject({
        success: false,
      })
      signInAs(f.id.owner)
      expect(await deleteEventByAdmin(f.eventId)).toEqual({ success: true })
    })
  })
})
