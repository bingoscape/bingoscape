/**
 * @jest-environment node
 *
 * What the database itself enforces for the team draft (team draft 1/4,
 * #215), and the team-membership helper. Written against real Postgres with
 * direct inserts: these are the backstops under the draft row lock.
 */
import { and, asc, eq, sql } from "drizzle-orm"

import { db } from "@/server/db"
import {
  addTeamMembers,
  createDraftTeams,
  type Tx,
} from "@/server/authz/team-membership"
import { createDraft, startDraft } from "@/server/draft/core"
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
import { replayDraft } from "@/lib/draft/reducer"
import {
  getDraftStamp,
  loadDraftEventsSince,
  loadDraftSnapshot,
  listDraftCandidates,
} from "@/server/draft/queries"
import {
  createDraftWorld,
  draftSettings,
  startedDraft,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"
import { performPick } from "@/server/draft/core"

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
let other: DraftWorld

beforeEach(async () => {
  w = await createDraftWorld({ captains: 3, players: 8 })
  other = await createDraftWorld({ captains: 2, players: 4 })
})
afterEach(async () => {
  await w.cleanup()
  await other.cleanup()
})

describe("draft tables", () => {
  it("allows one non-cancelled draft per Event", async () => {
    const { draftId } = await startedDraft(w)
    await expect(
      db.insert(drafts).values({ eventId: w.eventId, rounds: 1 })
    ).rejects.toThrow()

    // Cancelled drafts do not count.
    await db
      .update(drafts)
      .set({ status: "cancelled" })
      .where(eq(drafts.id, draftId))
    await expect(
      db.insert(drafts).values({ eventId: w.eventId, rounds: 1 })
    ).resolves.toBeDefined()
  })

  it("rejects a second pick with the same number, or of the same player", async () => {
    const { draftId } = await startedDraft(w)
    const [slot] = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, draftId))
      .orderBy(asc(draftTeamSlots.position))
    const [a, b] = await db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, draftId))
      .orderBy(asc(draftPoolEntries.id))
    await db.insert(draftPicks).values({
      draftId,
      pickNo: 1,
      round: 1,
      slotId: slot!.id,
      poolEntryId: a!.id,
    })
    await expect(
      db.insert(draftPicks).values({
        draftId,
        pickNo: 1,
        round: 1,
        slotId: slot!.id,
        poolEntryId: b!.id,
      })
    ).rejects.toThrow()
    await expect(
      db.insert(draftPicks).values({
        draftId,
        pickNo: 2,
        round: 1,
        slotId: slot!.id,
        poolEntryId: a!.id,
      })
    ).rejects.toThrow()
  })

  it("keeps a pick inside its draft (composite foreign keys)", async () => {
    const mine = await startedDraft(w)
    const theirs = await startedDraft(other)
    const [mySlot] = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, mine.draftId))
    const [myEntry] = await db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, mine.draftId))
    const [theirSlot] = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, theirs.draftId))
    const [theirEntry] = await db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, theirs.draftId))

    // A slot of another draft.
    await expect(
      db.insert(draftPicks).values({
        draftId: mine.draftId,
        pickNo: 1,
        round: 1,
        slotId: theirSlot!.id,
        poolEntryId: myEntry!.id,
      })
    ).rejects.toThrow()
    // A player of another draft.
    await expect(
      db.insert(draftPicks).values({
        draftId: mine.draftId,
        pickNo: 1,
        round: 1,
        slotId: mySlot!.id,
        poolEntryId: theirEntry!.id,
      })
    ).rejects.toThrow()
  })

  it("keeps slots and pool entries unique per draft", async () => {
    const { draftId } = await startedDraft(w)
    const [slot] = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, draftId))
    const [entry] = await db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, draftId))
    await expect(
      db.insert(draftTeamSlots).values({
        draftId,
        eventId: w.eventId,
        captainUserId: slot!.captainUserId,
        teamName: "Again",
        position: 99,
        maxTeamSize: 3,
      })
    ).rejects.toThrow()
    await expect(
      db.insert(draftTeamSlots).values({
        draftId,
        eventId: w.eventId,
        captainUserId: w.outsider,
        teamName: "Same place",
        position: slot!.position,
        maxTeamSize: 3,
      })
    ).rejects.toThrow()
    await expect(
      db.insert(draftPoolEntries).values({
        draftId,
        eventId: w.eventId,
        userId: entry!.userId,
        ratingSource: "x",
      })
    ).rejects.toThrow()
  })

  it("refuses a child row that names another Event than its draft", async () => {
    const { draftId } = await startedDraft(w)
    await expect(
      db.insert(draftPoolEntries).values({
        draftId,
        eventId: other.eventId,
        userId: other.outsider,
        ratingSource: "x",
      })
    ).rejects.toThrow()
  })

  it("assigns the log's seq itself, in order", async () => {
    const { draftId } = await startedDraft(w)
    await expect(
      db.execute(
        sql`INSERT INTO "bingoscape-next_draft_event" (draft_id, type, seq) VALUES (${draftId}, 'x', 1)`
      )
    ).rejects.toThrow()
    const log = await db
      .select()
      .from(draftEvents)
      .where(eq(draftEvents.draftId, draftId))
      .orderBy(asc(draftEvents.seq))
    expect(log.map((e) => e.type)).toEqual(["created", "started"])
    expect(log[1]!.seq).toBeGreaterThan(log[0]!.seq)
  })

  it("deleting the Event removes the draft with everything under it", async () => {
    const { draftId } = await startedDraft(other)
    await other.cleanup()
    expect(
      await db.select().from(drafts).where(eq(drafts.id, draftId))
    ).toEqual([])
    expect(
      await db
        .select()
        .from(draftEvents)
        .where(eq(draftEvents.draftId, draftId))
    ).toEqual([])
    // cleanup() runs again in afterEach: deleting nothing is fine.
  })
})

describe("addTeamMembers / createDraftTeams", () => {
  const run = <T>(fn: (tx: Tx) => Promise<T>) =>
    db.transaction((tx) => fn(tx as Tx))

  it("createDraftTeams creates Teams and leaders with event_id, and audits once", async () => {
    const result = await run((tx) =>
      createDraftTeams(tx, {
        eventId: w.eventId,
        draftId: "00000000-0000-4000-8000-000000000001",
        actor: { userId: w.manager },
        source: "draft_start",
        teams: [
          { name: "A", captainUserId: w.captains[0]! },
          { name: "B", captainUserId: w.captains[1]! },
        ],
      })
    )
    expect(result.success).toBe(true)
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.eventId, w.eventId))
    expect(members).toHaveLength(2)
    expect(members.every((m) => m.isLeader)).toBe(true)
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
  })

  it("refuses captains who are not participants or already on a Team, writing nothing", async () => {
    const draftId = "00000000-0000-4000-8000-000000000001"
    const notParticipant = await run((tx) =>
      createDraftTeams(tx, {
        eventId: w.eventId,
        draftId,
        actor: { userId: w.manager },
        source: "draft_start",
        teams: [
          { name: "A", captainUserId: w.captains[0]! },
          { name: "B", captainUserId: w.outsider },
        ],
      })
    )
    expect(notParticipant).toMatchObject({
      success: false,
      code: "NOT_PARTICIPANT",
      userIds: [w.outsider],
    })
    expect(
      await db.select().from(teams).where(eq(teams.eventId, w.eventId))
    ).toEqual([])

    const dup = await run((tx) =>
      createDraftTeams(tx, {
        eventId: w.eventId,
        draftId,
        actor: { userId: w.manager },
        source: "draft_start",
        teams: [
          { name: "A", captainUserId: w.captains[0]! },
          { name: "B", captainUserId: w.captains[0]! },
        ],
      })
    )
    expect(dup).toMatchObject({ success: false, code: "INVALID" })
  })

  it("addTeamMembers sets event_id, refuses a player on another Team and a player who left", async () => {
    const [a, b] = await db
      .insert(teams)
      .values([
        { eventId: w.eventId, name: "A" },
        { eventId: w.eventId, name: "B" },
      ])
      .returning({ id: teams.id })
    await db.insert(teamMembers).values({
      teamId: b!.id,
      eventId: w.eventId,
      userId: w.players[0]!,
    })
    const input = {
      eventId: w.eventId,
      teamId: a!.id,
      actor: { userId: w.manager },
      source: "draft_apply" as const,
    }

    expect(
      await run((tx) =>
        addTeamMembers(tx, {
          ...input,
          userIds: [w.players[1]!, w.players[0]!],
        })
      )
    ).toMatchObject({
      success: false,
      code: "ALREADY_ON_TEAM",
      userIds: [w.players[0]],
    })
    expect(
      await db.select().from(teamMembers).where(eq(teamMembers.teamId, a!.id))
    ).toEqual([])

    await db
      .delete(eventParticipants)
      .where(eq(eventParticipants.userId, w.players[2]!))
    expect(
      await run((tx) =>
        addTeamMembers(tx, {
          ...input,
          userIds: [w.players[1]!, w.players[2]!],
        })
      )
    ).toMatchObject({
      success: false,
      code: "NOT_PARTICIPANT",
      userIds: [w.players[2]],
    })

    const ok = await run((tx) =>
      addTeamMembers(tx, {
        ...input,
        userIds: [w.players[1]!, w.players[2]!],
        skipMissing: true,
      })
    )
    expect(ok).toMatchObject({
      success: true,
      added: [w.players[1]],
      skipped: [{ userId: w.players[2], reason: "not_participant" }],
    })
    const rows = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, a!.id))
    expect(rows).toEqual([
      expect.objectContaining({ userId: w.players[1], eventId: w.eventId }),
    ])
  })

  it("addTeamMembers refuses a Team of another Event", async () => {
    const [foreign] = await db
      .insert(teams)
      .values({ eventId: other.eventId, name: "Foreign" })
      .returning({ id: teams.id })
    expect(
      await run((tx) =>
        addTeamMembers(tx, {
          eventId: w.eventId,
          teamId: foreign!.id,
          userIds: [w.players[0]!],
          actor: { userId: w.manager },
          source: "draft_apply",
        })
      )
    ).toMatchObject({ success: false, code: "NOT_FOUND" })
  })

  it("waits for a concurrent participant removal (the Event row lock)", async () => {
    const [team] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "A" })
      .returning({ id: teams.id })
    const order: string[] = []
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))

    // Holds the Event row lock like removeMember does, then removes the player.
    const remover = db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from "bingoscape-next_events" where id = ${w.eventId} for update`
      )
      order.push("locked")
      await held
      await tx
        .delete(eventParticipants)
        .where(eq(eventParticipants.userId, w.players[0]!))
      order.push("removed")
    })
    // Wait until the remover really holds the lock (it can be slow under load).
    for (let i = 0; i < 100 && !order.includes("locked"); i++) {
      await new Promise((r) => setTimeout(r, 50))
    }
    expect(order).toEqual(["locked"])
    const adder = run(async (tx) => {
      const result = await addTeamMembers(tx, {
        eventId: w.eventId,
        teamId: team!.id,
        userIds: [w.players[0]!],
        actor: { userId: w.manager },
        source: "draft_apply",
      })
      order.push("added")
      return result
    })
    await new Promise((r) => setTimeout(r, 200))
    expect(order).toEqual(["locked"]) // the adder is blocked
    release()
    await remover
    const result = await adder
    // Serialised after the removal: it sees the player gone.
    expect(order).toEqual(["locked", "removed", "added"])
    expect(result).toMatchObject({ success: false, code: "NOT_PARTICIPANT" })
  })
})

describe("draft reads", () => {
  it("the snapshot matches what replaying the log gives", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2, captainCount: 3 })
    const slots = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, draftId))
      .orderBy(asc(draftTeamSlots.position))
    // Three picks by the on-turn captains (snake: 1, 2, 3).
    for (let i = 0; i < 3; i++) {
      const [entry] = await db
        .select()
        .from(draftPoolEntries)
        .where(
          and(
            eq(draftPoolEntries.draftId, draftId),
            eq(draftPoolEntries.status, "available")
          )
        )
        .orderBy(asc(draftPoolEntries.id))
      const actor = await w.actorOf(slots[i]!.captainUserId!)
      const result = await db.transaction((tx) =>
        performPick(tx as Tx, { draftId, poolEntryId: entry!.id, actor })
      )
      expect(result.success).toBe(true)
    }

    const snapshot = await loadDraftSnapshot(w.eventId)
    expect(snapshot).not.toBeNull()
    const events = await loadDraftEventsSince(draftId, 0)
    const replayed = replayDraft(events)
    const state = snapshot!.state
    expect(replayed.status).toBe(state.status)
    expect(replayed.currentPickNo).toBe(state.currentPickNo)
    expect(replayed.lastSeq).toBe(state.lastSeq)
    expect(replayed.permutation).toEqual(state.permutation)
    expect(replayed.slots).toEqual(state.slots)
    const byEntry = (list: typeof state.pool) =>
      [...list].sort((a, b) => a.poolEntryId.localeCompare(b.poolEntryId))
    // `leftEvent` is read from the participants, not from the log.
    const withoutLeft = (list: typeof state.pool) =>
      byEntry(list).map(({ leftEvent: _left, ...entry }) => entry)
    expect(withoutLeft(replayed.pool)).toEqual(withoutLeft(state.pool))
    expect(replayed.deadline).toBe(state.deadline)
    expect(replayed.pausedRemainingMs).toBe(state.pausedRemainingMs)
    expect(
      replayed.picks.map((p) => [p.pickNo, p.slotId, p.poolEntryId, p.pickedBy])
    ).toEqual(
      state.picks.map((p) => [p.pickNo, p.slotId, p.poolEntryId, p.pickedBy])
    )

    // Catch-up returns only what is newer.
    expect(
      (await loadDraftEventsSince(draftId, state.lastSeq - 1)).length
    ).toBe(1)
    expect(await loadDraftEventsSince(draftId, state.lastSeq)).toEqual([])

    const stamp = await getDraftStamp(w.eventId)
    expect(stamp).toMatchObject({
      draftId,
      status: "in_progress",
      version: snapshot!.version,
      seq: state.lastSeq,
    })
  })

  it("has no stamp or snapshot for an Event without a draft", async () => {
    expect(await getDraftStamp(w.eventId)).toBeNull()
    expect(await loadDraftSnapshot(w.eventId)).toBeNull()
  })

  it("lists the participants without a Team as candidates", async () => {
    const manager = await w.actorOf(w.manager)
    const created = await db.transaction((tx) =>
      createDraft(tx as Tx, {
        eventId: w.eventId,
        actor: manager,
        settings: draftSettings(w, { captainCount: 2 }),
      })
    )
    expect(created.success).toBe(true)
    const before = (await listDraftCandidates(w.eventId)).length
    // 8 players + 3 captains + owner + manager
    expect(before).toBe(13)
    if (created.success) {
      await db.transaction((tx) =>
        startDraft(tx as Tx, { draftId: created.draftId, actor: manager })
      )
    }
    // The two captains now sit on Teams.
    expect((await listDraftCandidates(w.eventId)).length).toBe(11)
  })
})
