/**
 * @jest-environment node
 *
 * The pick timer on real Postgres (team draft 3/4, #217): deadlines come from
 * the database clock, an expired turn is resolved under the draft row lock
 * (exactly once, never together with a pick), each `on_timeout` mode, pause and
 * resume, undo with the partial unique indexes, the sweeper lock, the captain
 * queue and what the snapshot reports.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/server/db"
import {
  createDraft,
  performPick,
  pauseDraft,
  resumeDraft,
  setPickQueue,
  skipTurn,
  undoPick,
  type Tx,
} from "@/server/draft/core"
import {
  SWEEPER_LOCK_KEY,
  resolveExpired,
  settleExpiredDraft,
  startDraftSweeper,
  stopDraftSweeper,
  sweepExpiredDrafts,
} from "@/server/draft/expire"
import { loadDraftEventsSince, loadDraftSnapshot } from "@/server/draft/queries"
import {
  draftEvents,
  draftPicks,
  draftPoolEntries,
  draftQueueEntries,
  draftTeamSlots,
  drafts,
  eventParticipants,
  users,
} from "@/server/db/schema"
import {
  createDraftWorld,
  draftSettings,
  rate,
  startedDraft,
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

let w: DraftWorld

beforeEach(async () => {
  w = await createDraftWorld({ captains: 3, players: 10 })
})
afterEach(async () => {
  stopDraftSweeper()
  await w.cleanup()
})

// --- helpers ---------------------------------------------------------------

const draftRow = async (draftId: string) =>
  (await db.select().from(drafts).where(eq(drafts.id, draftId)))[0]!

const slotsOf = (draftId: string) =>
  db
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draftId))
    .orderBy(asc(draftTeamSlots.position))

const standingPicks = (draftId: string) =>
  db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.draftId, draftId), isNull(draftPicks.undoneAt)))
    .orderBy(asc(draftPicks.pickNo))

const allPicks = (draftId: string) =>
  db.select().from(draftPicks).where(eq(draftPicks.draftId, draftId))

const entryOfUser = async (draftId: string, userId: string) =>
  (
    await db
      .select()
      .from(draftPoolEntries)
      .where(
        and(
          eq(draftPoolEntries.draftId, draftId),
          eq(draftPoolEntries.userId, userId)
        )
      )
  )[0]!

const availableEntries = (draftId: string) =>
  db
    .select()
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draftId),
        eq(draftPoolEntries.status, "available")
      )
    )
    .orderBy(asc(draftPoolEntries.snapshotAt), asc(draftPoolEntries.id))

/** The deadline of the turn is in the past, as if the captain went AFK. */
const expire = (draftId: string) =>
  db
    .update(drafts)
    .set({ turnDeadline: sql`clock_timestamp() - interval '1 second'` })
    .where(eq(drafts.id, draftId))

const resolve = (draftId: string) =>
  db.transaction((tx) => resolveExpired(tx as Tx, draftId))

/** Seconds from the database clock to `turn_deadline`. */
const secondsToDeadline = async (draftId: string) => {
  const rows = await db.execute<{ s: number }>(
    sql`select extract(epoch from (turn_deadline - clock_timestamp()))::float8 as s
        from ${drafts} where id = ${draftId}`
  )
  return Number(rows[0]!.s)
}

const eventsOf = async (draftId: string, type?: string) =>
  (await loadDraftEventsSince(draftId, 0)).filter(
    (e) => type === undefined || e.type === type
  )

/** The captain whose turn it is at `pickNo`, for `captainCount` captains in snake order. */
const captainAt = async (draftId: string, pickNo: number) => {
  const slots = await slotsOf(draftId)
  const n = slots.length
  const round = Math.floor((pickNo - 1) / n) + 1
  const index = (pickNo - 1) % n
  return slots[round % 2 === 0 ? n - 1 - index : index]!
}

const pickAs = async (
  draftId: string,
  userId: string,
  poolEntryId: string,
  world: DraftWorld = w
) => {
  const actor = await world.actorOf(userId)
  return db.transaction((tx) =>
    performPick(tx as Tx, { draftId, poolEntryId, actor })
  )
}

const manager = () => w.actorOf(w.manager)

// --- the deadline ----------------------------------------------------------

describe("turn_deadline", () => {
  it("is set from the database clock at the start, and logged with serverNow", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 60 })
    const seconds = await secondsToDeadline(draftId)
    expect(seconds).toBeGreaterThan(58)
    expect(seconds).toBeLessThanOrEqual(60)

    const [started] = await eventsOf(draftId, "started")
    const payload = started!.payload as {
      deadline: string
      serverNow: string
    }
    // The deadline is the database clock plus the timer; `serverNow` was read
    // a moment after it was computed.
    const span = Date.parse(payload.deadline) - Date.parse(payload.serverNow)
    expect(span).toBeGreaterThan(59_000)
    expect(span).toBeLessThanOrEqual(60_000)
  })

  it("stays empty without a timer", async () => {
    const { draftId } = await startedDraft(w)
    expect((await draftRow(draftId)).turnDeadline).toBeNull()
    expect(await resolve(draftId)).toEqual({ acted: false })
  })

  it("restarts after every pick", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 60 })
    await db
      .update(drafts)
      .set({ turnDeadline: sql`clock_timestamp() + interval '5 seconds'` })
      .where(eq(drafts.id, draftId))
    const captain = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    expect(
      await pickAs(draftId, captain.captainUserId!, entry!.id)
    ).toMatchObject({ success: true })
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(55)

    const [pick] = await eventsOf(draftId, "pick")
    expect(pick!.payload).toMatchObject({
      auto: false,
      consecutiveTimeouts: 0,
      deadline: expect.any(String),
      serverNow: expect.any(String),
    })
  })

  it("is armed when a draft that started without one is touched (a deploy mid-draft)", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await db
      .update(drafts)
      .set({ turnDeadline: null })
      .where(eq(drafts.id, draftId))

    expect(await resolve(draftId)).toEqual({ acted: false })
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(28)
    expect(await eventsOf(draftId, "timer")).toHaveLength(1)
    expect(await standingPicks(draftId)).toHaveLength(0)
  })
})

// --- expiry ----------------------------------------------------------------

describe("resolveExpired: auto_pick", () => {
  it("picks the best rated available player and marks the pick as automatic", async () => {
    await rate(w, {
      [w.players[2]!]: { ehp: 100, ehb: 10, hours: 2 },
      [w.players[5]!]: { ehp: 900, ehb: 300, hours: 6 },
      [w.players[7]!]: { ehp: 500, ehb: 100, hours: 4 },
    })
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)

    expect(await resolve(draftId)).toEqual({ acted: true })

    const [pick] = await standingPicks(draftId)
    const best = await entryOfUser(draftId, w.players[5]!)
    expect(pick).toMatchObject({
      pickNo: 1,
      poolEntryId: best.id,
      auto: true,
      reason: "timer_auto",
      pickedBy: null,
    })
    const row = await draftRow(draftId)
    expect(row.currentPickNo).toBe(2)
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(28)

    const [event] = await eventsOf(draftId, "pick")
    expect(event).toMatchObject({
      actorUserId: null,
      payload: { auto: true, reason: "timer_auto", consecutiveTimeouts: 1 },
    })
  })

  it("picks a random available player with the random rule", async () => {
    const { draftId } = await startedDraft(w, {
      pickTimerSeconds: 30,
      autoPickRule: "random",
    })
    await expire(draftId)
    await resolve(draftId)
    const [pick] = await standingPicks(draftId)
    expect(pick).toMatchObject({ auto: true, reason: "timer_auto" })
  })

  it("never picks a player who left the event", async () => {
    await rate(w, {
      [w.players[1]!]: { ehp: 900, ehb: 300, hours: 6 },
      [w.players[2]!]: { ehp: 100, ehb: 10, hours: 2 },
    })
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, w.players[1]!)
        )
      )
    await expire(draftId)
    await resolve(draftId)
    const [pick] = await standingPicks(draftId)
    expect(pick!.poolEntryId).toBe(
      (await entryOfUser(draftId, w.players[2]!)).id
    )
  })

  it("does nothing while the deadline has not passed", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    expect(await resolve(draftId)).toEqual({ acted: false })
    expect(await standingPicks(draftId)).toHaveLength(0)
  })

  it("yields exactly one auto-pick when called twice concurrently", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)

    const results = await Promise.all([
      resolve(draftId),
      resolve(draftId),
      resolve(draftId),
    ])

    expect(results.filter((r) => r.acted)).toHaveLength(1)
    expect(await standingPicks(draftId)).toHaveLength(1)
    expect((await draftRow(draftId)).currentPickNo).toBe(2)
  })

  it("never lets an expiry and a real pick both win", async () => {
    for (let round = 0; round < 4; round++) {
      const world = await createDraftWorld({ captains: 3, players: 6 })
      try {
        const { draftId } = await startedDraft(world, { pickTimerSeconds: 30 })
        const captain = await captainAt(draftId, 1)
        const [entry] = await availableEntries(draftId)
        await expire(draftId)

        const [pick, expiry] = await Promise.all([
          pickAs(draftId, captain.captainUserId!, entry!.id, world),
          resolve(draftId),
        ])

        const picks = await standingPicks(draftId)
        expect(picks.map((p) => p.pickNo)).toEqual([1])
        // The deadline had passed: the timer's pick stands and the captain's
        // late one is refused, whichever got the lock first.
        expect(picks[0]!.auto).toBe(true)
        expect(pick.success === false || expiry.acted === false).toBe(true)
        expect((await draftRow(draftId)).currentPickNo).toBe(2)
      } finally {
        await world.cleanup()
      }
    }
  }, 60_000)

  it("refuses a pick that arrives after the deadline, and the timer's pick stands", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const captain = await captainAt(draftId, 1)
    const entries = await availableEntries(draftId)
    await expire(draftId)

    const result = await pickAs(draftId, captain.captainUserId!, entries[0]!.id)

    expect(result).toMatchObject({ success: false, code: "CONFLICT" })
    const picks = await standingPicks(draftId)
    expect(picks).toHaveLength(1)
    expect(picks[0]).toMatchObject({ auto: true, pickNo: 1 })
  })

  it("keeps the client from touching the deadline: only the database sets it", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const before = await draftRow(draftId)
    const captain = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    // A refused pick (wrong captain) changes nothing, the deadline included.
    const other = w.captains.find((c) => c !== captain.captainUserId)!
    expect(await pickAs(draftId, other, entry!.id)).toMatchObject({
      success: false,
    })
    expect((await draftRow(draftId)).turnDeadline).toEqual(before.turnDeadline)
  })
})

describe("on_timeout modes", () => {
  it("skip: the captain loses the pick and the next team is on the clock", async () => {
    const { draftId } = await startedDraft(w, {
      pickTimerSeconds: 30,
      onTimeout: "skip",
    })
    await expire(draftId)
    await resolve(draftId)

    expect(await standingPicks(draftId)).toHaveLength(0)
    expect((await draftRow(draftId)).currentPickNo).toBe(2)
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(28)
    const [skipped] = await eventsOf(draftId, "skipped")
    expect(skipped!.payload).toMatchObject({
      pickNo: 1,
      reason: "timer_skip",
      consecutiveTimeouts: 1,
    })
    const slots = await slotsOf(draftId)
    expect(slots[0]!.consecutiveTimeouts).toBe(1)
  })

  it("skip: a team that reached max_team_size is passed over", async () => {
    // Captain plus one player; three rounds would give them more.
    const { draftId } = await startedDraft(w, {
      pickTimerSeconds: 30,
      onTimeout: "skip",
      rounds: 3,
      maxTeamSize: 2,
    })
    const slots = await slotsOf(draftId)
    expect(slots.every((s) => s.maxTeamSize === 2)).toBe(true)

    // Team 1 times out; teams 2 and 3 pick.
    await expire(draftId)
    await resolve(draftId)
    for (const pickNo of [2, 3]) {
      const captain = await captainAt(draftId, pickNo)
      const [entry] = await availableEntries(draftId)
      expect(
        await pickAs(draftId, captain.captainUserId!, entry!.id)
      ).toMatchObject({ success: true })
    }

    // Round two (snake) starts with teams 3 and 2, both full by now: team 1,
    // which lost its first pick, is next.
    const row = await draftRow(draftId)
    expect(row.status).toBe("in_progress")
    expect(row.currentPickNo).toBe(6)
    const passed = (await eventsOf(draftId, "skipped")).filter(
      (e) => (e.payload as { reason: string }).reason === "team_full"
    )
    expect(passed.map((e) => (e.payload as { pickNo: number }).pickNo)).toEqual(
      [4, 5]
    )
  })

  it("completes the draft when every team is full", async () => {
    const { draftId } = await startedDraft(w, { rounds: 3, maxTeamSize: 2 })
    for (const pickNo of [1, 2, 3]) {
      const captain = await captainAt(draftId, pickNo)
      const [entry] = await availableEntries(draftId)
      await pickAs(draftId, captain.captainUserId!, entry!.id)
    }
    const row = await draftRow(draftId)
    expect(row.status).toBe("complete")
    expect(row.turnDeadline).toBeNull()
    expect(await eventsOf(draftId, "completed")).toHaveLength(1)
    // Leftover players stay available for the manager ("Unassigned"): the
    // pool is the ten players plus the owner and the manager, minus 3 picks.
    expect(await availableEntries(draftId)).toHaveLength(9)
  })

  it("pause: the draft pauses with the full time stored, until a manager resumes", async () => {
    const { draftId } = await startedDraft(w, {
      pickTimerSeconds: 30,
      onTimeout: "pause",
    })
    await expire(draftId)
    await resolve(draftId)

    const row = await draftRow(draftId)
    expect(row).toMatchObject({
      status: "paused",
      turnDeadline: null,
      pausedRemainingMs: 30_000,
      currentPickNo: 1,
    })
    const [paused] = await eventsOf(draftId, "paused")
    expect(paused!.payload).toMatchObject({
      reason: "timer",
      deadline: null,
      pausedRemainingMs: 30_000,
    })

    expect(
      await db.transaction(async (tx) =>
        resumeDraft(tx as Tx, { draftId, actor: await manager() })
      )
    ).toMatchObject({ success: true })
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(28)
    expect((await draftRow(draftId)).status).toBe("in_progress")
  })

  it("flags a captain after consecutive timeouts, and a pick of their own resets it", async () => {
    // Two captains, snake: A, B, B, A, A, B.
    const w2 = await createDraftWorld({ captains: 2, players: 12 })
    try {
      const { draftId } = await startedDraft(w2, {
        pickTimerSeconds: 30,
        rounds: 4,
      })
      const slots = async () => slotsOf(draftId)
      const bySlot = async (position: number) =>
        (await slots()).find((s) => s.position === position)!

      for (let i = 0; i < 3; i++) {
        await expire(draftId)
        await resolve(draftId)
      }
      // Picks 1 (A), 2 (B), 3 (B) timed out.
      expect((await bySlot(1)).consecutiveTimeouts).toBe(2)
      expect((await bySlot(0)).consecutiveTimeouts).toBe(1)

      const snapshot = await loadDraftSnapshot(w2.eventId)
      expect(
        snapshot!.state.slots.find((s) => s.position === 1)!.consecutiveTimeouts
      ).toBe(2)

      // Picks 4 and 5 are team A's, 6 is team B's: B's own pick ends its streak.
      for (const pickNo of [4, 5, 6]) {
        const captain = await captainAt(draftId, pickNo)
        const [entry] = await availableEntries(draftId)
        const actor = await w2.actorOf(captain.captainUserId!)
        expect(
          await db.transaction((tx) =>
            performPick(tx as Tx, {
              draftId,
              poolEntryId: entry!.id,
              actor,
            })
          )
        ).toMatchObject({ success: true })
      }
      expect((await bySlot(1)).consecutiveTimeouts).toBe(0)
      expect((await bySlot(0)).consecutiveTimeouts).toBe(0)
    } finally {
      await w2.cleanup()
    }
  })
})

// --- the captain queue -----------------------------------------------------

describe("pick queue", () => {
  it("is used before the rating rule, in order, skipping players who are gone", async () => {
    await rate(w, { [w.players[0]!]: { ehp: 900, ehb: 300, hours: 6 } })
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const first = await captainAt(draftId, 1)
    const wanted = [
      await entryOfUser(draftId, w.players[8]!),
      await entryOfUser(draftId, w.players[9]!),
    ]
    const captain = await w.actorOf(first.captainUserId!)
    expect(
      await db.transaction((tx) =>
        setPickQueue(tx as Tx, {
          draftId,
          actor: captain,
          poolEntryIds: wanted.map((e) => e.id),
        })
      )
    ).toMatchObject({ success: true, count: 2 })

    await expire(draftId)
    await resolve(draftId)
    const [pick] = await standingPicks(draftId)
    expect(pick).toMatchObject({
      poolEntryId: wanted[0]!.id,
      reason: "timer_queue",
      auto: true,
    })

    // Picks 2 to 5 go to other players; team 1 is on the clock again at pick
    // 6 (snake). The queue's first entry is taken by now: the second is used.
    for (const pickNo of [2, 3, 4, 5]) {
      const c = await captainAt(draftId, pickNo)
      const entry = (await availableEntries(draftId)).find(
        (e) => !wanted.some((x) => x.id === e.id)
      )
      await pickAs(draftId, c.captainUserId!, entry!.id)
    }
    await expire(draftId)
    await resolve(draftId)
    const picks = await standingPicks(draftId)
    expect(picks.at(-1)).toMatchObject({
      pickNo: 6,
      poolEntryId: wanted[1]!.id,
      reason: "timer_queue",
    })
  })

  it("only lets a captain set their own queue, and only with available players", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const [a, b] = await availableEntries(draftId)

    const outsider = await w.actorOf(w.players[0]!)
    expect(
      await db.transaction((tx) =>
        setPickQueue(tx as Tx, {
          draftId,
          actor: outsider,
          poolEntryIds: [a!.id],
        })
      )
    ).toMatchObject({ success: false, code: "FORBIDDEN" })

    const slots = await slotsOf(draftId)
    const captain = await w.actorOf(slots[1]!.captainUserId!)
    await pickAs(draftId, slots[0]!.captainUserId!, b!.id)
    const result = await db.transaction((tx) =>
      setPickQueue(tx as Tx, {
        draftId,
        actor: captain,
        // `b` was just picked, and the second id is made up.
        poolEntryIds: [
          b!.id,
          a!.id,
          a!.id,
          "00000000-0000-4000-8000-000000000000",
        ],
      })
    )
    expect(result).toMatchObject({ success: true, count: 1 })
    const stored = await db
      .select()
      .from(draftQueueEntries)
      .where(eq(draftQueueEntries.slotId, slots[1]!.id))
    expect(stored.map((q) => q.poolEntryId)).toEqual([a!.id])
  })
})

// --- pause, resume, skip ---------------------------------------------------

describe("pause and resume", () => {
  it("freezes the remaining time and resume restores it", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 60 })
    await db
      .update(drafts)
      .set({ turnDeadline: sql`clock_timestamp() + interval '40 seconds'` })
      .where(eq(drafts.id, draftId))
    const actor = await manager()

    expect(
      await db.transaction((tx) => pauseDraft(tx as Tx, { draftId, actor }))
    ).toMatchObject({ success: true })
    const paused = await draftRow(draftId)
    expect(paused.turnDeadline).toBeNull()
    expect(paused.pausedRemainingMs).toBeGreaterThan(38_000)
    expect(paused.pausedRemainingMs).toBeLessThanOrEqual(40_000)
    const [pausedEvent] = await eventsOf(draftId, "paused")
    expect(pausedEvent!.payload).toMatchObject({
      reason: "manual",
      pausedRemainingMs: paused.pausedRemainingMs,
    })

    // Time passes while paused; nothing can expire.
    await new Promise((resolveWait) => setTimeout(resolveWait, 600))
    expect(await resolve(draftId)).toEqual({ acted: false })

    expect(
      await db.transaction((tx) => resumeDraft(tx as Tx, { draftId, actor }))
    ).toMatchObject({ success: true })
    const resumed = await draftRow(draftId)
    expect(resumed.status).toBe("in_progress")
    expect(resumed.pausedRemainingMs).toBeNull()
    const left = await secondsToDeadline(draftId)
    // What was left when it paused (to within the call), not what remained
    // after the pause: the pause did not eat into it.
    expect(left * 1000).toBeGreaterThan(paused.pausedRemainingMs! - 1000)
    expect(left * 1000).toBeLessThanOrEqual(paused.pausedRemainingMs!)
  })

  it("a paused draft takes no picks and its timer does not run", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const actor = await manager()
    await db.transaction((tx) => pauseDraft(tx as Tx, { draftId, actor }))
    const captain = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    expect(
      await pickAs(draftId, captain.captainUserId!, entry!.id)
    ).toMatchObject({ success: false, code: "CONFLICT" })
  })
})

describe("skipTurn", () => {
  it("passes the on-turn captain's pick without counting it as a timeout", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const actor = await manager()
    expect(
      await db.transaction((tx) => skipTurn(tx as Tx, { draftId, actor }))
    ).toMatchObject({ success: true, pickNo: 1 })

    expect((await draftRow(draftId)).currentPickNo).toBe(2)
    expect((await slotsOf(draftId))[0]!.consecutiveTimeouts).toBe(0)
    const [skipped] = await eventsOf(draftId, "skipped")
    expect(skipped).toMatchObject({
      actorUserId: w.manager,
      payload: { pickNo: 1, reason: "manual_skip" },
    })
  })
})

// --- undo ------------------------------------------------------------------

describe("undoPick", () => {
  it("soft-deletes the pick, keeps numbers contiguous and lets the player be picked again", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const actor = await manager()
    const first = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    await pickAs(draftId, first.captainUserId!, entry!.id)

    expect(
      await db.transaction((tx) => undoPick(tx as Tx, { draftId, actor }))
    ).toMatchObject({ success: true, pickNo: 1 })

    // The row stays, marked; nothing stands.
    const rows = await allPicks(draftId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.undoneAt).not.toBeNull()
    expect(await standingPicks(draftId)).toHaveLength(0)
    const row = await draftRow(draftId)
    expect(row.currentPickNo).toBe(1)
    expect(await secondsToDeadline(draftId)).toBeGreaterThan(28)
    const [undo] = await eventsOf(draftId, "undo")
    expect(undo!.payload).toMatchObject({ pickNo: 1, poolEntryId: entry!.id })

    // The partial unique indexes ignore the undone pick.
    expect(
      await pickAs(draftId, first.captainUserId!, entry!.id)
    ).toMatchObject({ success: true, pickNo: 1 })
    expect((await standingPicks(draftId)).map((p) => p.pickNo)).toEqual([1])
    expect(await allPicks(draftId)).toHaveLength(2)
  })

  it("reopens a completed draft and undoes the last standing pick only", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1, captainCount: 2 })
    const actor = await manager()
    for (const pickNo of [1, 2]) {
      const captain = await captainAt(draftId, pickNo)
      const [entry] = await availableEntries(draftId)
      await pickAs(draftId, captain.captainUserId!, entry!.id)
    }
    expect((await draftRow(draftId)).status).toBe("complete")

    await db.transaction((tx) => undoPick(tx as Tx, { draftId, actor }))
    expect(await draftRow(draftId)).toMatchObject({
      status: "in_progress",
      currentPickNo: 2,
      completedAt: null,
    })
    expect((await standingPicks(draftId)).map((p) => p.pickNo)).toEqual([1])

    await db.transaction((tx) => undoPick(tx as Tx, { draftId, actor }))
    expect((await draftRow(draftId)).currentPickNo).toBe(1)
    expect(
      await db.transaction((tx) => undoPick(tx as Tx, { draftId, actor }))
    ).toMatchObject({ success: false, code: "CONFLICT" })
  })

  it("takes an auto-pick's timeout back off the captain's count", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)
    await resolve(draftId)
    expect((await slotsOf(draftId))[0]!.consecutiveTimeouts).toBe(1)

    await db.transaction(async (tx) =>
      undoPick(tx as Tx, { draftId, actor: await manager() })
    )
    expect((await slotsOf(draftId))[0]!.consecutiveTimeouts).toBe(0)
  })

  it("keeps a paused draft paused, with the full time stored", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    const actor = await manager()
    const captain = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    await pickAs(draftId, captain.captainUserId!, entry!.id)
    await db.transaction((tx) => pauseDraft(tx as Tx, { draftId, actor }))
    await db.transaction((tx) => undoPick(tx as Tx, { draftId, actor }))
    expect(await draftRow(draftId)).toMatchObject({
      status: "paused",
      turnDeadline: null,
      pausedRemainingMs: 30_000,
      currentPickNo: 1,
    })
  })
})

// --- the sweeper -----------------------------------------------------------

describe("sweeper", () => {
  it("resolves expired turns", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)

    const result = await sweepExpiredDrafts()

    expect(result.locked).toBe(true)
    expect(result.resolved).toBeGreaterThanOrEqual(1)
    expect(await standingPicks(draftId)).toHaveLength(1)
  })

  it("lets only one of two sweepers act", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)

    // Sweeper A holds the advisory lock (as a running sweep does).
    let release!: () => void
    const held = new Promise<void>((resolveHold) => (release = resolveHold))
    let acquired!: () => void
    const isHeld = new Promise<void>(
      (resolveAcquired) => (acquired = resolveAcquired)
    )
    const holder = db.transaction(async (tx) => {
      const rows = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(${SWEEPER_LOCK_KEY}::bigint) as locked`
      )
      expect(rows[0]!.locked).toBe(true)
      acquired()
      await held
    })
    await isHeld

    // Sweeper B finds it taken and does nothing.
    expect(await sweepExpiredDrafts()).toEqual({ locked: false, resolved: 0 })
    expect(await standingPicks(draftId)).toHaveLength(0)

    release()
    await holder
    const after = await sweepExpiredDrafts()
    expect(after.locked).toBe(true)
    expect(await standingPicks(draftId)).toHaveLength(1)
  })

  it("never double-picks when two sweeps run at the same time", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)
    await Promise.all([sweepExpiredDrafts(), sweepExpiredDrafts()])
    expect(await standingPicks(draftId)).toHaveLength(1)
  })

  it("runs on its own once started, and resolves what expired before it started", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    await expire(draftId)

    startDraftSweeper(50)

    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if ((await standingPicks(draftId)).length > 0) break
      await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    }
    stopDraftSweeper()
    expect(await standingPicks(draftId)).toHaveLength(1)
  })

  it("settleExpiredDraft resolves the Event's expired turn for a reader", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 30 })
    expect(await settleExpiredDraft(w.eventId)).toBe(false)
    await expire(draftId)
    expect(await settleExpiredDraft(w.eventId)).toBe(true)
    expect(await standingPicks(draftId)).toHaveLength(1)
    expect(await settleExpiredDraft(w.eventId)).toBe(false)
  })
})

// --- what the snapshot reports ---------------------------------------------

describe("snapshot", () => {
  it("carries the deadline and the database time", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 45 })
    const snapshot = await loadDraftSnapshot(w.eventId)
    const row = await draftRow(draftId)
    expect(snapshot!.state.deadline).toBe(row.turnDeadline!.toISOString())
    expect(snapshot!.serverNow).toBe(snapshot!.state.serverNow)
    const skew = Date.parse(snapshot!.serverNow) - Date.now()
    expect(Math.abs(skew)).toBeLessThan(5000)
    expect(
      Date.parse(snapshot!.state.deadline!) - Date.parse(snapshot!.serverNow)
    ).toBeGreaterThan(40_000)
  })

  it("marks players who left the event, and lists late joiners", async () => {
    const { draftId } = await startedDraft(w)
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, w.players[0]!)
        )
      )
    const [late] = await db
      .insert(users)
      .values({ name: "late", email: `late-${Date.now()}@draft.test` })
      .returning({ id: users.id })
    await db
      .insert(eventParticipants)
      .values({ eventId: w.eventId, userId: late!.id, role: "participant" })

    const snapshot = await loadDraftSnapshot(w.eventId)
    const left = await entryOfUser(draftId, w.players[0]!)
    expect(
      snapshot!.state.pool.find((e) => e.poolEntryId === left.id)
    ).toMatchObject({ leftEvent: true })
    expect(
      snapshot!.state.pool.filter((e) => e.leftEvent === true)
    ).toHaveLength(1)
    expect(snapshot!.lateJoiners).toEqual([late!.id])
    // The pool stays frozen: the late joiner is not in it.
    expect(snapshot!.state.pool.some((e) => e.userId === late!.id)).toBe(false)
    await db.delete(users).where(eq(users.id, late!.id))
  })

  it("shows a preview pool before the start, with late joiners tagged New", async () => {
    const actor = await manager()
    const created = await db.transaction((tx) =>
      createDraft(tx as Tx, {
        eventId: w.eventId,
        actor,
        settings: draftSettings(w),
      })
    )
    expect(created.success).toBe(true)

    const [late] = await db
      .insert(users)
      .values({ name: "late", email: `late2-${Date.now()}@draft.test` })
      .returning({ id: users.id })
    await db
      .insert(eventParticipants)
      .values({ eventId: w.eventId, userId: late!.id, role: "participant" })

    const snapshot = await loadDraftSnapshot(w.eventId)
    const pool = snapshot!.state.pool
    // Everybody without a Team except the captains: players, owner, manager,
    // the late joiner.
    expect(pool.some((e) => w.captains.includes(e.userId!))).toBe(false)
    expect(pool.filter((e) => e.isNew)).toHaveLength(1)
    expect(pool.find((e) => e.isNew)!.userId).toBe(late!.id)
    expect(snapshot!.lateJoiners).toEqual([])
    await db.delete(users).where(eq(users.id, late!.id))
  })

  it("no longer shows an undone pick", async () => {
    const { draftId } = await startedDraft(w)
    const captain = await captainAt(draftId, 1)
    const [entry] = await availableEntries(draftId)
    await pickAs(draftId, captain.captainUserId!, entry!.id)
    await db.transaction(async (tx) =>
      undoPick(tx as Tx, { draftId, actor: await manager() })
    )
    const snapshot = await loadDraftSnapshot(w.eventId)
    expect(snapshot!.state.picks).toEqual([])
    expect(snapshot!.state.currentPickNo).toBe(1)
    const log = await db
      .select({ type: draftEvents.type })
      .from(draftEvents)
      .where(eq(draftEvents.draftId, draftId))
      .orderBy(asc(draftEvents.seq))
    expect(log.map((l) => l.type)).toEqual([
      "created",
      "started",
      "pick",
      "undo",
    ])
  })
})
