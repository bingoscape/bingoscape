/**
 * @jest-environment node
 *
 * Phase 3 of the participants rework against real Postgres (each test rolls
 * back): a registration request can only be reviewed once, partial payments,
 * player metadata that belongs to participants only, and team deletion.
 */
import { and, eq } from "drizzle-orm"

import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  requestToJoinEvent,
  setParticipantPayment,
  updateParticipantBuyIn,
} from "@/app/actions/events"
import {
  calculateMetadataCoverage,
  getEventParticipantMetadata,
  updatePlayerMetadata,
} from "@/app/actions/player-metadata"
import { deleteTeam } from "@/app/actions/team"
import { withDb } from "@/lib/test-utils"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventBuyIns,
  eventParticipants,
  eventRegistrationRequests,
  events,
  playerMetadata,
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

const DAY_MS = 24 * 60 * 60 * 1000

async function seed() {
  const suffix = Math.random().toString(36).slice(2)
  const names = ["owner", "player", "applicant", "outsider"] as const
  const created = await db
    .insert(users)
    .values(
      names.map((name) => ({
        name,
        email: `${name}-${suffix}@hardening.test`,
      }))
    )
    .returning({ id: users.id, email: users.email })
  const id = Object.fromEntries(
    names.map((n) => [
      n,
      created.find((u) => u.email === `${n}-${suffix}@hardening.test`)!.id,
    ])
  ) as Record<(typeof names)[number], string>

  const [event] = await db
    .insert(events)
    .values({
      title: "Hardening",
      startDate: new Date(Date.now() + DAY_MS),
      endDate: new Date(Date.now() + 2 * DAY_MS),
      creatorId: id.owner,
      minimumBuyIn: 100,
      requiresApproval: true,
    })
    .returning({ id: events.id })
  const eventId = event!.id
  await db.insert(eventParticipants).values([
    { eventId, userId: id.owner, role: "admin" },
    { eventId, userId: id.player, role: "participant" },
  ])
  return { id, eventId }
}

const participantsOf = (eventId: string, userId: string) =>
  db
    .select()
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, userId)
      )
    )

const buyInOf = async (eventId: string, userId: string) => {
  const [participant] = await participantsOf(eventId, userId)
  const rows = await db
    .select()
    .from(eventBuyIns)
    .where(eq(eventBuyIns.eventParticipantId, participant!.id))
  return rows
}

async function pendingRequest(eventId: string, userId: string) {
  const [row] = await db
    .insert(eventRegistrationRequests)
    .values({ eventId, userId, status: "pending" })
    .returning({ id: eventRegistrationRequests.id })
  return row!.id
}

describe("reviewing a registration request", () => {
  it("approves a pending request once and refuses a second review", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const requestId = await pendingRequest(f.eventId, f.id.applicant)

      expect(await approveRegistrationRequest(requestId)).toEqual({
        success: true,
      })
      expect(await approveRegistrationRequest(requestId)).toMatchObject({
        success: false,
        code: "CONFLICT",
      })
      expect(await participantsOf(f.eventId, f.id.applicant)).toHaveLength(1)
    })
  })

  it("does not approve a request that was rejected", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const requestId = await pendingRequest(f.eventId, f.id.applicant)
      await rejectRegistrationRequest(requestId, "full")

      const result = await approveRegistrationRequest(requestId)

      expect(result).toMatchObject({ success: false, code: "CONFLICT" })
      expect(await participantsOf(f.eventId, f.id.applicant)).toHaveLength(0)
    })
  })

  it("does not reject a request that was approved, and keeps the participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const requestId = await pendingRequest(f.eventId, f.id.applicant)
      await approveRegistrationRequest(requestId)

      const result = await rejectRegistrationRequest(requestId)

      expect(result).toMatchObject({ success: false, code: "CONFLICT" })
      const request = await db.query.eventRegistrationRequests.findFirst({
        where: eq(eventRegistrationRequests.id, requestId),
      })
      expect(request?.status).toBe("approved")
      expect(await participantsOf(f.eventId, f.id.applicant)).toHaveLength(1)
    })
  })

  it("refuses a join request from someone who already participates", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.player)

      const result = await requestToJoinEvent(f.eventId, "let me in")

      expect(result).toMatchObject({ success: false, code: "CONFLICT" })
      const requests = await db
        .select()
        .from(eventRegistrationRequests)
        .where(eq(eventRegistrationRequests.eventId, f.eventId))
      expect(requests).toHaveLength(0)
    })
  })
})

describe("buy-ins and partial payments", () => {
  it("records a partial payment and then the rest", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const partial = await setParticipantPayment(f.eventId, f.id.player, 40)
      expect(partial).toEqual({
        success: true,
        buyInAmount: 40,
        expectedAmount: 100,
      })
      const full = await setParticipantPayment(f.eventId, f.id.player, 100)
      expect(full).toMatchObject({ success: true, buyInAmount: 100 })

      const rows = await buyInOf(f.eventId, f.id.player)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ amount: 100, expectedAmount: 100 })
    })
  })

  it("keeps what was owed when the minimum buy-in changes later", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      await setParticipantPayment(f.eventId, f.id.player, 40)
      await db
        .update(events)
        .set({ minimumBuyIn: 500 })
        .where(eq(events.id, f.eventId))

      const paid = await updateParticipantBuyIn(f.eventId, f.id.player, true)

      expect(paid).toMatchObject({
        success: true,
        buyInAmount: 100,
        expectedAmount: 100,
      })
    })
  })

  it("marks unpaid by zeroing the amount and creates no row for an untouched participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      await updateParticipantBuyIn(f.eventId, f.id.player, false)
      expect(await buyInOf(f.eventId, f.id.player)).toHaveLength(0)

      await updateParticipantBuyIn(f.eventId, f.id.player, true)
      await updateParticipantBuyIn(f.eventId, f.id.player, false)
      const rows = await buyInOf(f.eventId, f.id.player)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.amount).toBe(0)
    })
  })

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    "rejects the payment amount %p",
    async (amount) => {
      await withDb(async () => {
        const f = await seed()
        signInAs(f.id.owner)

        const result = await setParticipantPayment(
          f.eventId,
          f.id.player,
          amount
        )

        expect(result).toMatchObject({ success: false, code: "INVALID" })
        expect(await buyInOf(f.eventId, f.id.player)).toHaveLength(0)
      })
    }
  )

  it("does not record a payment for someone who is not a participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const result = await setParticipantPayment(f.eventId, f.id.outsider, 10)

      expect(result.success).toBe(false)
    })
  })

  it("lets a regular participant not record payments", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.player)

      const result = await setParticipantPayment(f.eventId, f.id.player, 10)

      expect(result.success).toBe(false)
      expect(await buyInOf(f.eventId, f.id.player)).toHaveLength(0)
    })
  })
})

describe("player metadata", () => {
  const metadataRows = (eventId: string) =>
    db.select().from(playerMetadata).where(eq(playerMetadata.eventId, eventId))

  it("refuses metadata for someone who is not a participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      const result = await updatePlayerMetadata(f.id.outsider, f.eventId, {
        ehp: 10,
      })

      expect(result).toMatchObject({ success: false, code: "NOT_FOUND" })
      expect(await metadataRows(f.eventId)).toHaveLength(0)
    })
  })

  it("updates in place and keeps one row per player", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)

      await updatePlayerMetadata(f.id.player, f.eventId, { ehp: 10 })
      await updatePlayerMetadata(f.id.player, f.eventId, { ehb: 5 })

      const rows = await metadataRows(f.eventId)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ ehp: 10, ehb: 5 })
    })
  })

  it("ignores rows of players who left the event in coverage and in the balancing data", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      await updatePlayerMetadata(f.id.player, f.eventId, { ehp: 10 })
      // A leftover of a removed player.
      await db
        .insert(playerMetadata)
        .values({ userId: f.id.outsider, eventId: f.eventId, ehp: 99 })

      // 2 participants (owner, player), 1 with metadata.
      expect(await calculateMetadataCoverage(f.eventId)).toBe(50)
      const rows = await getEventParticipantMetadata(f.eventId)
      expect(rows.map((r) => r.userId)).toEqual([f.id.player])
    })
  })
})

describe("deleteTeam", () => {
  it("removes the team together with its members", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.id.owner)
      const [team] = await db
        .insert(teams)
        .values({ eventId: f.eventId, name: "Alpha" })
        .returning({ id: teams.id })
      await db.insert(teamMembers).values({
        teamId: team!.id,
        eventId: f.eventId,
        userId: f.id.player,
        isLeader: false,
      })

      expect(await deleteTeam(team!.id)).toMatchObject({ success: true })

      expect(
        await db.select().from(teams).where(eq(teams.id, team!.id))
      ).toHaveLength(0)
      expect(
        await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.userId, f.id.player))
      ).toHaveLength(0)
    })
  })
})
