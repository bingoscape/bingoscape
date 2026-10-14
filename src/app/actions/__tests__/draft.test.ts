/**
 * @jest-environment node
 *
 * The team draft server actions end to end on real Postgres (team draft 1/4,
 * #215): authorization, the lifecycle, picking, undo, apply and cancel. The
 * data is committed; every test builds its own world.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm"

import {
  applyDraft,
  cancelDraft,
  createDraft,
  forcePick,
  makePick,
  pauseDraft,
  resumeDraft,
  startDraft,
  undoPick,
} from "@/app/actions/draft"
import { isPermutation } from "@/lib/draft/order"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  draftEvents,
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  drafts,
  eventAuditLog,
  eventParticipants,
  teamMembers,
  teams,
} from "@/server/db/schema"
import { resetRateLimits } from "@/server/rate-limit"
import {
  createDraftWorld,
  draftSettings,
  rate,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (userId: string | null) =>
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)

let w: DraftWorld

beforeEach(async () => {
  resetRateLimits()
  w = await createDraftWorld({ captains: 4, players: 12 })
})
afterEach(async () => {
  await w.cleanup()
})

async function create(overrides: Parameters<typeof draftSettings>[1] = {}) {
  signInAs(w.manager)
  const result = await createDraft({
    eventId: w.eventId,
    ...draftSettings(w, overrides),
  })
  if (!result.success) throw new Error(result.error)
  return result.draftId
}

async function start(overrides: Parameters<typeof draftSettings>[1] = {}) {
  const draftId = await create(overrides)
  signInAs(w.manager)
  const result = await startDraft({ draftId })
  if (!result.success) throw new Error(result.error)
  return draftId
}

const draftRow = async (draftId: string) =>
  (await db.select().from(drafts).where(eq(drafts.id, draftId)))[0]!
const slotsOf = (draftId: string) =>
  db
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draftId))
    .orderBy(asc(draftTeamSlots.position))
const poolOf = (draftId: string) =>
  db
    .select()
    .from(draftPoolEntries)
    .where(eq(draftPoolEntries.draftId, draftId))
const picksOf = (draftId: string) =>
  db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.draftId, draftId), isNull(draftPicks.undoneAt)))
    .orderBy(asc(draftPicks.pickNo))
const teamsOfEvent = () =>
  db.select().from(teams).where(eq(teams.eventId, w.eventId))
const membersOfEvent = () =>
  db.select().from(teamMembers).where(eq(teamMembers.eventId, w.eventId))

/** The captain whose turn it is, from the draft's own order. */
async function onTurnCaptain(draftId: string): Promise<string> {
  const draft = await draftRow(draftId)
  const slots = await slotsOf(draftId)
  const [started] = await db
    .select()
    .from(draftEvents)
    .where(
      and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "started"))
    )
  const permutation = (started!.payload as { permutation: number[] })
    .permutation
  const n = slots.length
  const round = Math.floor((draft.currentPickNo - 1) / n) + 1
  const index = (draft.currentPickNo - 1) % n
  const orderIndex =
    draft.orderType !== "linear" && round % 2 === 0 ? n - 1 - index : index
  return slots[permutation[orderIndex]!]!.captainUserId!
}

async function availableEntry(draftId: string, skip = 0) {
  const rows = await db
    .select()
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draftId),
        eq(draftPoolEntries.status, "available")
      )
    )
    .orderBy(asc(draftPoolEntries.id))
  return rows[skip]!
}

/** The on-turn captain picks the first available player. */
async function pickNext(draftId: string) {
  signInAs(await onTurnCaptain(draftId))
  const entry = await availableEntry(draftId)
  const result = await makePick({ draftId, poolEntryId: entry.id })
  if (!result.success) throw new Error(result.error)
  return result
}

async function completeDraft(draftId: string) {
  for (;;) {
    const result = await pickNext(draftId)
    if (result.completed) return
  }
}

describe("createDraft", () => {
  it("lets a manager create a draft in setup with its captain slots", async () => {
    const draftId = await create({ orderType: "linear", rounds: 3 })
    const draft = await draftRow(draftId)
    expect(draft).toMatchObject({
      eventId: w.eventId,
      status: "setup",
      orderType: "linear",
      rounds: 3,
      currentPickNo: 1,
      createdBy: w.manager,
      seed: null,
    })
    const slots = await slotsOf(draftId)
    expect(
      slots.map((s) => [s.position, s.captainUserId, s.maxTeamSize])
    ).toEqual(w.captains.map((id, i) => [i, id, 4]))
    // Teams are not created before the start.
    expect(slots.every((s) => s.teamId === null)).toBe(true)
    expect(await teamsOfEvent()).toEqual([])
    const log = await db
      .select()
      .from(draftEvents)
      .where(eq(draftEvents.draftId, draftId))
    expect(log.map((e) => e.type)).toEqual(["created"])
  })

  it("denies participants, outsiders and anonymous callers, and creates nothing", async () => {
    for (const [who, code] of [
      [w.players[0]!, "FORBIDDEN"],
      [w.captains[0]!, "FORBIDDEN"],
      [w.outsider, "FORBIDDEN"],
      [null, "UNAUTHENTICATED"],
    ] as const) {
      signInAs(who)
      const result = await createDraft({
        eventId: w.eventId,
        ...draftSettings(w),
      })
      expect(result).toMatchObject({ success: false, code })
    }
    expect(
      await db.select().from(drafts).where(eq(drafts.eventId, w.eventId))
    ).toEqual([])
  })

  it("allows only one live draft per Event, but a cancelled one does not count", async () => {
    const first = await create()
    signInAs(w.manager)
    expect(
      await createDraft({ eventId: w.eventId, ...draftSettings(w) })
    ).toMatchObject({ success: false, code: "CONFLICT" })

    expect(await cancelDraft({ draftId: first })).toMatchObject({
      success: true,
    })
    expect(
      await createDraft({ eventId: w.eventId, ...draftSettings(w) })
    ).toMatchObject({ success: true })
  })

  it("refuses captains who are not participants or already on a Team", async () => {
    signInAs(w.manager)
    const notParticipant = await createDraft({
      eventId: w.eventId,
      ...draftSettings(w, {
        captains: [
          { userId: w.captains[0]!, teamName: "A" },
          { userId: w.outsider, teamName: "B" },
        ],
      }),
    })
    expect(notParticipant).toMatchObject({ success: false, code: "INVALID" })

    const [team] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "Existing" })
      .returning({ id: teams.id })
    await db.insert(teamMembers).values({
      teamId: team!.id,
      eventId: w.eventId,
      userId: w.captains[1]!,
    })
    const onATeam = await createDraft({
      eventId: w.eventId,
      ...draftSettings(w),
    })
    expect(onATeam).toMatchObject({ success: false, code: "CONFLICT" })
  })

  it("rejects invalid input", async () => {
    signInAs(w.manager)
    expect(
      await createDraft({
        eventId: w.eventId,
        ...draftSettings(w, { captainCount: 1 }),
      })
    ).toMatchObject({ success: false, code: "INVALID" })
    expect(
      await createDraft({ eventId: "nope", ...draftSettings(w) })
    ).toMatchObject({ success: false, code: "INVALID" })
  })
})

describe("startDraft", () => {
  it("creates the Teams and captain memberships, freezes and rates the pool, stores the order", async () => {
    // Two of the players have data; one more player already sits on a Team.
    await rate(w, {
      [w.players[0]!]: { ehp: 100, ehb: 10, hours: 1 },
      [w.players[1]!]: { ehp: 900, ehb: 90, hours: 5 },
    })
    const [existing] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "Existing" })
      .returning({ id: teams.id })
    await db.insert(teamMembers).values({
      teamId: existing!.id,
      eventId: w.eventId,
      userId: w.players[2]!,
    })

    const draftId = await create()
    signInAs(w.manager)
    const result = await startDraft({ draftId })
    // 12 players + owner + manager, minus the one on a Team (captains leave the pool).
    expect(result).toMatchObject({ success: true, poolSize: 13, teams: 4 })

    const draft = await draftRow(draftId)
    expect(draft.status).toBe("in_progress")
    expect(draft.startedAt).not.toBeNull()
    expect(draft.seed).toBeGreaterThan(0)
    expect(draft.version).toBe(1)

    const slots = await slotsOf(draftId)
    expect(slots.every((s) => s.teamId !== null)).toBe(true)
    const leaders = await membersOfEvent()
    for (const slot of slots) {
      expect(leaders.filter((m) => m.teamId === slot.teamId)).toEqual([
        expect.objectContaining({
          userId: slot.captainUserId,
          isLeader: true,
          eventId: w.eventId,
        }),
      ])
    }
    expect((await teamsOfEvent()).map((t) => t.name).sort()).toEqual([
      "Existing",
      "Team 1",
      "Team 2",
      "Team 3",
      "Team 4",
    ])

    const pool = await poolOf(draftId)
    const poolUsers = new Set(pool.map((p) => p.userId))
    expect(pool).toHaveLength(13)
    expect(pool.every((p) => p.status === "available")).toBe(true)
    for (const captain of w.captains) expect(poolUsers.has(captain)).toBe(false)
    expect(poolUsers.has(w.players[2]!)).toBe(false)
    expect(poolUsers.has(w.manager)).toBe(true)
    const rating = (userId: string) =>
      pool.find((p) => p.userId === userId)!.ratingSnapshot
    expect(rating(w.players[1]!)!).toBeGreaterThan(rating(w.players[0]!)!)
    expect(rating(w.players[3]!)).toBeNull() // no data: unrated
    expect(new Set(pool.map((p) => p.ratingSource))).toEqual(
      new Set(["team_balancing_v1"])
    )

    const [startedEvent] = await db
      .select()
      .from(draftEvents)
      .where(
        and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "started"))
      )
    const payload = startedEvent!.payload as {
      seed: number
      permutation: number[]
      pool: unknown[]
    }
    expect(payload.seed).toBe(draft.seed)
    expect(payload.permutation).toEqual([0, 1, 2, 3])
    expect(payload.pool).toHaveLength(13)
  })

  it("stores a seeded permutation for random_snake", async () => {
    const draftId = await start({ orderType: "random_snake" })
    const [startedEvent] = await db
      .select()
      .from(draftEvents)
      .where(
        and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "started"))
      )
    const { permutation } = startedEvent!.payload as { permutation: number[] }
    expect(isPermutation(permutation, 4)).toBe(true)
  })

  it("writes one audit row for the Team creation", async () => {
    const draftId = await start()
    const audit = await db
      .select()
      .from(eventAuditLog)
      .where(
        and(
          eq(eventAuditLog.eventId, w.eventId),
          eq(eventAuditLog.action, "team.draft_teams.create")
        )
      )
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      actorUserId: w.manager,
      targetId: draftId,
      outcome: "success",
    })
  })

  it("starts only a draft in setup, and only for managers", async () => {
    const draftId = await create()
    signInAs(w.captains[0]!)
    expect(await startDraft({ draftId })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.manager)
    expect(await startDraft({ draftId })).toMatchObject({ success: true })
    expect(await startDraft({ draftId })).toMatchObject({
      success: false,
      code: "CONFLICT",
    })
  })

  it("leaves nothing behind when a captain joined a Team in the meantime", async () => {
    const draftId = await create()
    const [team] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "Sneaky" })
      .returning({ id: teams.id })
    await db.insert(teamMembers).values({
      teamId: team!.id,
      eventId: w.eventId,
      userId: w.captains[1]!,
    })
    signInAs(w.manager)
    expect(await startDraft({ draftId })).toMatchObject({
      success: false,
      code: "CONFLICT",
    })
    expect((await teamsOfEvent()).map((t) => t.name)).toEqual(["Sneaky"])
    expect((await draftRow(draftId)).status).toBe("setup")
    expect(await poolOf(draftId)).toEqual([])
  })

  it("refuses to start without anyone left to draft", async () => {
    const draftId = await create()
    await db
      .delete(eventParticipants)
      .where(
        inArray(eventParticipants.userId, [...w.players, w.owner, w.manager])
      )
    // The creator counts as admin without a participant row.
    signInAs(w.owner)
    expect(await startDraft({ draftId })).toMatchObject({
      success: false,
      error: "There are no players left to draft",
    })
    expect(await teamsOfEvent()).toEqual([])
  })

  it("does not act across Events", async () => {
    const other = await createDraftWorld({ captains: 2, players: 4 })
    try {
      const draftId = await create()
      signInAs(other.manager)
      expect(await startDraft({ draftId })).toMatchObject({
        success: false,
        code: "FORBIDDEN",
      })
      expect(
        await startDraft({ draftId: "00000000-0000-4000-8000-000000000000" })
      ).toMatchObject({ success: false, code: "NOT_FOUND" })
    } finally {
      await other.cleanup()
    }
  })
})

describe("picking", () => {
  it("lets the on-turn captain pick and records it with the log", async () => {
    const draftId = await start()
    const captain = await onTurnCaptain(draftId)
    expect(captain).toBe(w.captains[0])
    const entry = await availableEntry(draftId)

    signInAs(captain)
    const result = await makePick({ draftId, poolEntryId: entry.id })
    expect(result).toMatchObject({ success: true, pickNo: 1, completed: false })

    const [pick] = await picksOf(draftId)
    const slots = await slotsOf(draftId)
    expect(pick).toMatchObject({
      pickNo: 1,
      round: 1,
      slotId: slots[0]!.id,
      poolEntryId: entry.id,
      pickedBy: captain,
      auto: false,
      reason: null,
    })
    const draft = await draftRow(draftId)
    expect(draft.currentPickNo).toBe(2)
    expect(draft.version).toBe(2)
    expect((await poolOf(draftId)).find((p) => p.id === entry.id)!.status).toBe(
      "drafted"
    )
    // Drafted players reach team_members only when the manager applies.
    expect((await membersOfEvent()).map((m) => m.userId).sort()).toEqual(
      [...w.captains].sort()
    )
  })

  it("follows the snake order across rounds", async () => {
    const draftId = await start({ rounds: 2 })
    const order: string[] = []
    for (let i = 0; i < 8; i++) {
      order.push(await onTurnCaptain(draftId))
      await pickNext(draftId)
    }
    const c = w.captains
    expect(order).toEqual([c[0], c[1], c[2], c[3], c[3], c[2], c[1], c[0]])
  })

  it("refuses a captain who is not on turn, a non-captain and an outsider", async () => {
    const draftId = await start()
    const entry = await availableEntry(draftId)

    signInAs(w.captains[1]!)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      error: "It is not your turn",
      code: "CONFLICT",
    })
    signInAs(w.players[0]!)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      error: "Only a captain can pick",
      code: "FORBIDDEN",
    })
    // Not even a manager picks through makePick: they use forcePick.
    signInAs(w.manager)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.outsider)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(null)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
    })
    expect(await picksOf(draftId)).toEqual([])
  })

  it("refuses a player who was already picked, or is not in this draft", async () => {
    const draftId = await start()
    const entry = await availableEntry(draftId)
    signInAs(await onTurnCaptain(draftId))
    await makePick({ draftId, poolEntryId: entry.id })

    signInAs(await onTurnCaptain(draftId))
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      error: "That player is not available",
    })
    expect(
      await makePick({
        draftId,
        poolEntryId: "00000000-0000-4000-8000-000000000000",
      })
    ).toMatchObject({ success: false, code: "NOT_FOUND" })
    expect(await picksOf(draftId)).toHaveLength(1)
  })

  it("refuses a player who left the Event", async () => {
    const draftId = await start()
    const entry = await availableEntry(draftId)
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, entry.userId!)
        )
      )
    signInAs(await onTurnCaptain(draftId))
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      error: "That player has left the event",
    })
  })

  it("lets a manager pick for the on-turn captain, and nobody else", async () => {
    const draftId = await start()
    const entry = await availableEntry(draftId)
    signInAs(w.captains[0]!)
    expect(await forcePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.manager)
    expect(await forcePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: true,
      pickNo: 1,
    })
    const [pick] = await picksOf(draftId)
    expect(pick).toMatchObject({ pickedBy: w.manager, reason: "forced" })
    const slots = await slotsOf(draftId)
    expect(pick!.slotId).toBe(slots[0]!.id)
  })

  it("does not pick while the draft is paused or not running", async () => {
    const draftId = await create()
    const entryless = "00000000-0000-4000-8000-000000000000"
    signInAs(w.captains[0]!)
    expect(await makePick({ draftId, poolEntryId: entryless })).toMatchObject({
      success: false,
      error: "The draft has not started yet",
    })

    signInAs(w.manager)
    await startDraft({ draftId })
    signInAs(w.captains[0]!)
    expect(await pauseDraft({ draftId })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.manager)
    expect(await pauseDraft({ draftId })).toMatchObject({ success: true })
    expect(await pauseDraft({ draftId })).toMatchObject({
      success: false,
      code: "CONFLICT",
    })

    const entry = await availableEntry(draftId)
    signInAs(w.captains[0]!)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: false,
      error: "The draft is paused",
    })
    signInAs(w.manager)
    expect(await resumeDraft({ draftId })).toMatchObject({ success: true })
    signInAs(w.captains[0]!)
    expect(await makePick({ draftId, poolEntryId: entry.id })).toMatchObject({
      success: true,
    })
  })

  it("completes the draft after the last pick, then refuses more", async () => {
    const draftId = await start({ rounds: 1, captainCount: 2 })
    await pickNext(draftId)
    expect((await draftRow(draftId)).status).toBe("in_progress")
    const last = await pickNext(draftId)
    expect(last.completed).toBe(true)

    const draft = await draftRow(draftId)
    expect(draft.status).toBe("complete")
    expect(draft.completedAt).not.toBeNull()
    const types = (
      await db
        .select()
        .from(draftEvents)
        .where(eq(draftEvents.draftId, draftId))
        .orderBy(asc(draftEvents.seq))
    ).map((e) => e.type)
    expect(types).toEqual(["created", "started", "pick", "pick", "completed"])

    signInAs(w.captains[0]!)
    expect(
      await makePick({
        draftId,
        poolEntryId: (await availableEntry(draftId)).id,
      })
    ).toMatchObject({ success: false, error: "The draft is complete" })
  })

  it("completes when the pool runs out before the rounds do", async () => {
    // 2 captains, 5 rounds would take 10 picks; only 1 player in the pool.
    await db
      .delete(eventParticipants)
      .where(
        inArray(eventParticipants.userId, [
          ...w.players.slice(1),
          ...w.captains.slice(2),
          w.owner,
        ])
      )
    const draftId = await start({ rounds: 5, captainCount: 2 })
    // Two captains leave the pool: the first player and the manager remain.
    expect((await poolOf(draftId)).length).toBe(2)
    await pickNext(draftId)
    const second = await pickNext(draftId)
    expect(second.completed).toBe(true)
  })
})

describe("undoPick", () => {
  it("is for managers: removes the last pick and returns the player to the pool", async () => {
    const draftId = await start()
    await pickNext(draftId)
    const entry = await pickNext(draftId)
    const picks = await picksOf(draftId)
    expect(picks).toHaveLength(2)
    void entry

    signInAs(w.captains[0]!)
    expect(await undoPick({ draftId })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.manager)
    expect(await undoPick({ draftId })).toMatchObject({
      success: true,
      pickNo: 2,
    })

    const remaining = await picksOf(draftId)
    expect(remaining.map((p) => p.pickNo)).toEqual([1])
    expect((await draftRow(draftId)).currentPickNo).toBe(2)
    expect(
      (await poolOf(draftId)).find((p) => p.id === picks[1]!.poolEntryId)!
        .status
    ).toBe("available")

    expect(await undoPick({ draftId })).toMatchObject({
      success: true,
      pickNo: 1,
    })
    expect(await undoPick({ draftId })).toMatchObject({
      success: false,
      error: "There is no pick to undo",
    })
  })

  it("reopens a completed draft", async () => {
    const draftId = await start({ rounds: 1, captainCount: 2 })
    await completeDraft(draftId)
    expect((await draftRow(draftId)).status).toBe("complete")
    signInAs(w.manager)
    expect(await undoPick({ draftId })).toMatchObject({ success: true })
    const draft = await draftRow(draftId)
    expect(draft.status).toBe("in_progress")
    expect(draft.completedAt).toBeNull()
    expect(draft.currentPickNo).toBe(2)
  })
})

describe("applyDraft", () => {
  it("writes the drafted players to team_members with event_id, after a manager confirms", async () => {
    const draftId = await start({ rounds: 2, captainCount: 3 })
    await completeDraft(draftId)
    expect((await draftRow(draftId)).status).toBe("complete")
    const before = (await membersOfEvent()).length
    expect(before).toBe(3) // captains only until applied

    signInAs(w.captains[0]!)
    expect(await applyDraft({ draftId })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    expect((await membersOfEvent()).length).toBe(3)

    signInAs(w.manager)
    expect(await applyDraft({ draftId })).toMatchObject({
      success: true,
      applied: 6,
      skippedUserIds: [],
    })

    const slots = await slotsOf(draftId)
    const picks = await picksOf(draftId)
    const pool = await poolOf(draftId)
    const members = await membersOfEvent()
    expect(members).toHaveLength(9)
    for (const slot of slots) {
      const expectedPlayers = picks
        .filter((p) => p.slotId === slot.id)
        .map((p) => pool.find((e) => e.id === p.poolEntryId)!.userId)
      const onTeam = members.filter((m) => m.teamId === slot.teamId)
      expect(
        onTeam
          .filter((m) => !m.isLeader)
          .map((m) => m.userId)
          .sort()
      ).toEqual([...expectedPlayers].sort())
      expect(onTeam.filter((m) => m.isLeader).map((m) => m.userId)).toEqual([
        slot.captainUserId,
      ])
      expect(onTeam.every((m) => m.eventId === w.eventId)).toBe(true)
    }
    // Leftover pool players stay unassigned.
    const drafted = new Set(
      pool.filter((e) => e.status === "drafted").map((e) => e.userId)
    )
    const leftover = pool.filter((e) => !drafted.has(e.userId))
    expect(leftover.length).toBeGreaterThan(0)
    for (const entry of leftover) {
      expect(members.some((m) => m.userId === entry.userId)).toBe(false)
    }

    const draft = await draftRow(draftId)
    expect(draft.appliedAt).not.toBeNull()
    const audit = await db
      .select()
      .from(eventAuditLog)
      .where(
        and(
          eq(eventAuditLog.eventId, w.eventId),
          eq(eventAuditLog.action, "team.members.add")
        )
      )
    expect(audit).toHaveLength(3) // one row per call
    expect(audit.every((a) => a.actorUserId === w.manager)).toBe(true)

    expect(await applyDraft({ draftId })).toMatchObject({
      success: false,
      error: "The teams were already applied",
    })
    expect(await undoPick({ draftId })).toMatchObject({ success: false })
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: false,
      error: "The teams were already applied",
    })
  })

  it("requires a complete draft", async () => {
    const draftId = await start()
    signInAs(w.manager)
    expect(await applyDraft({ draftId })).toMatchObject({
      success: false,
      error: "Only a complete draft can be applied",
    })
  })

  it("rejects a conflicting member and writes nothing", async () => {
    const draftId = await start({ rounds: 2, captainCount: 3 })
    await completeDraft(draftId)

    // A drafted player of the LAST slot is put on another Team by hand.
    const slots = await slotsOf(draftId)
    const picks = await picksOf(draftId)
    const pool = await poolOf(draftId)
    const lastSlotPick = picks.filter((p) => p.slotId === slots[2]!.id)[0]!
    const victim = pool.find((e) => e.id === lastSlotPick.poolEntryId)!.userId!
    const [other] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "Other" })
      .returning({ id: teams.id })
    await db
      .insert(teamMembers)
      .values({ teamId: other!.id, eventId: w.eventId, userId: victim })

    const membersBefore = (await membersOfEvent()).length
    signInAs(w.manager)
    const result = await applyDraft({ draftId })
    expect(result).toMatchObject({ success: false, code: "CONFLICT" })
    // The first slots were not applied either: all or nothing.
    expect((await membersOfEvent()).length).toBe(membersBefore)
    expect((await draftRow(draftId)).appliedAt).toBeNull()
  })

  it("reports players who left the Event instead of failing", async () => {
    const draftId = await start({ rounds: 2, captainCount: 3 })
    await completeDraft(draftId)
    const picks = await picksOf(draftId)
    const pool = await poolOf(draftId)
    // The pool also holds the owner and the manager (participants without a
    // Team); the one who leaves must not be the manager who applies.
    const leaver = picks
      .map((p) => pool.find((e) => e.id === p.poolEntryId)!.userId!)
      .find((userId) => w.players.includes(userId))!
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, leaver)
        )
      )

    signInAs(w.manager)
    expect(await applyDraft({ draftId })).toMatchObject({
      success: true,
      applied: 5,
      skippedUserIds: [leaver],
    })
    expect((await membersOfEvent()).some((m) => m.userId === leaver)).toBe(
      false
    )
    const [applied] = await db
      .select()
      .from(draftEvents)
      .where(
        and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "applied"))
      )
    expect((applied!.payload as { skipped: string[] }).skipped).toEqual([
      leaver,
    ])
  })
})

describe("cancelDraft", () => {
  it("cancels a draft in setup", async () => {
    const draftId = await create()
    signInAs(w.captains[0]!)
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: false,
      code: "FORBIDDEN",
    })
    signInAs(w.manager)
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: true,
      deletedTeams: 0,
    })
    expect((await draftRow(draftId)).status).toBe("cancelled")
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: false,
      error: "The draft was already cancelled",
    })
  })

  it("deletes the Teams a started draft created when they hold only the captain", async () => {
    const draftId = await start()
    await pickNext(draftId) // drafted, but not applied: no team_members yet
    signInAs(w.manager)
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: true,
      deletedTeams: 4,
      keptTeams: 0,
    })
    expect(await teamsOfEvent()).toEqual([])
    expect(await membersOfEvent()).toEqual([])
    const [last] = await db
      .select()
      .from(draftEvents)
      .where(
        and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "cancelled"))
      )
    expect(
      (last!.payload as { deletedTeamIds: string[] }).deletedTeamIds
    ).toHaveLength(4)
    // The slots stay, with the Team reference cleared.
    expect((await slotsOf(draftId)).every((s) => s.teamId === null)).toBe(true)
  })

  it("keeps a Team that holds more than its captain", async () => {
    const draftId = await start()
    const slots = await slotsOf(draftId)
    await db.insert(teamMembers).values({
      teamId: slots[0]!.teamId!,
      eventId: w.eventId,
      userId: w.players[0]!,
    })
    signInAs(w.manager)
    expect(await cancelDraft({ draftId })).toMatchObject({
      success: true,
      deletedTeams: 3,
      keptTeams: 1,
    })
    const left = await teamsOfEvent()
    expect(left.map((t) => t.id)).toEqual([slots[0]!.teamId])
    expect((await membersOfEvent()).map((m) => m.userId).sort()).toEqual(
      [w.captains[0]!, w.players[0]!].sort()
    )
  })
})

describe("the log", () => {
  it("is append-only, ordered by seq and written with each change", async () => {
    const draftId = await start({ rounds: 1, captainCount: 2 })
    await pickNext(draftId)
    signInAs(w.manager)
    await undoPick({ draftId })
    await pauseDraft({ draftId })
    await resumeDraft({ draftId })
    const log = await db
      .select()
      .from(draftEvents)
      .where(eq(draftEvents.draftId, draftId))
      .orderBy(asc(draftEvents.seq))
    expect(log.map((e) => e.type)).toEqual([
      "created",
      "started",
      "pick",
      "undo",
      "paused",
      "resumed",
    ])
    const seqs = log.map((e) => e.seq)
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(log[2]!.actorUserId).toBe(w.captains[0])
    expect(log[3]!.actorUserId).toBe(w.manager)
  })
})
