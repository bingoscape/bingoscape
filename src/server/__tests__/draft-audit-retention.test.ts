/**
 * @jest-environment node
 *
 * Audit and retention of the team draft on real Postgres (team draft 4/4,
 * #218): one `event_audit_log` row per manager action, in the transaction of
 * the change; the draft log follows the audit retention window and can be
 * anonymised for a user's erasure.
 */
import { and, asc, eq, inArray, like } from "drizzle-orm"

import { EVENT_AUDIT_RETENTION_DAYS } from "@/server/authz/audit-log"
import { db } from "@/server/db"
import {
  applyDraft,
  cancelDraft,
  createDraft,
  pauseDraft,
  performPick,
  resumeDraft,
  skipTurn,
  startDraft,
  undoPick,
  type Tx,
} from "@/server/draft/core"
import {
  anonymiseDraftActor,
  purgeExpiredDraftLogs,
} from "@/server/draft/retention"
import { loadDraftSnapshot } from "@/server/draft/queries"
import { onTurnSlot } from "@/lib/draft/view"
import {
  draftEvents,
  draftPoolEntries,
  drafts,
  eventAuditLog,
} from "@/server/db/schema"
import {
  createDraftWorld,
  draftSettings,
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
  w = await createDraftWorld({ captains: 2, players: 6 })
})
afterEach(async () => {
  await w.cleanup()
})

const inTx = <T>(fn: (tx: Tx) => Promise<T>) =>
  db.transaction((tx) => fn(tx as Tx))

const auditRows = () =>
  db
    .select()
    .from(eventAuditLog)
    .where(
      and(
        eq(eventAuditLog.eventId, w.eventId),
        like(eventAuditLog.action, "draft.%")
      )
    )
    .orderBy(asc(eventAuditLog.createdAt), asc(eventAuditLog.id))

async function firstAvailable(draftId: string) {
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
    .limit(1)
  return entry!
}

describe("audit of manager actions", () => {
  it("writes one row per manager action and none for a captain's pick", async () => {
    const manager = await w.actorOf(w.manager)
    const { draftId } = await startedDraft(w, { rounds: 1 })

    expect(
      await inTx((tx) => pauseDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true })
    expect(
      await inTx((tx) => resumeDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true })
    // The manager picks for the captain, then passes the next turn.
    const forced = await inTx(async (tx) =>
      performPick(tx, {
        draftId,
        poolEntryId: (await firstAvailable(draftId)).id,
        actor: manager,
        force: true,
      })
    )
    expect(forced.success).toBe(true)
    expect(
      await inTx((tx) => skipTurn(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true, completed: true })
    expect(
      await inTx((tx) => undoPick(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true, pickNo: 1 })

    // The captain picks pick 1 again, a manager forces pick 2: complete.
    const snapshot = (await loadDraftSnapshot(w.eventId))!
    const captain = await w.actorOf(onTurnSlot(snapshot.state)!.captainUserId!)
    expect(
      await inTx(async (tx) =>
        performPick(tx, {
          draftId,
          poolEntryId: (await firstAvailable(draftId)).id,
          actor: captain,
        })
      )
    ).toMatchObject({ success: true })
    expect(
      await inTx(async (tx) =>
        performPick(tx, {
          draftId,
          poolEntryId: (await firstAvailable(draftId)).id,
          actor: manager,
          force: true,
        })
      )
    ).toMatchObject({ success: true, completed: true })
    expect(
      await inTx((tx) => applyDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true })

    const rows = await auditRows()
    expect(rows.map((r) => r.action)).toEqual([
      "draft.start",
      "draft.pause",
      "draft.resume",
      "draft.force_pick",
      "draft.skip_turn",
      "draft.undo",
      "draft.force_pick",
      "draft.apply",
    ])
    for (const row of rows) {
      expect(row).toMatchObject({
        eventId: w.eventId,
        actorUserId: w.manager,
        permission: "draft:manage",
        targetType: "draft",
        targetId: draftId,
        outcome: "success",
      })
    }
    const [start, , , forceOne, skip, undo, , apply] = rows
    expect(start!.after).toMatchObject({ status: "in_progress", teams: 2 })
    expect(forceOne!.after).toMatchObject({ pickNo: 1 })
    expect(skip!.after).toMatchObject({ pickNo: 2 })
    expect(undo!.before).toMatchObject({ pickNo: 1, status: "complete" })
    expect(apply!.after).toMatchObject({ applied: true })
  })

  it("writes the cancel row too, and none for a refused action", async () => {
    const manager = await w.actorOf(w.manager)
    const created = await inTx((tx) =>
      createDraft(tx, {
        eventId: w.eventId,
        actor: manager,
        settings: draftSettings(w, { rounds: 1 }),
      })
    )
    if (!created.success) throw new Error(created.error)
    const draftId = created.draftId

    // Not running yet: refused, nothing is logged.
    expect(
      await inTx((tx) => pauseDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: false })
    expect(
      await inTx((tx) => applyDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: false })
    expect(await auditRows()).toHaveLength(0)

    expect(
      await inTx((tx) => cancelDraft(tx, { draftId, actor: manager }))
    ).toMatchObject({ success: true })
    expect((await auditRows()).map((r) => r.action)).toEqual(["draft.cancel"])
  })

  it("does not log a start that was refused", async () => {
    const manager = await w.actorOf(w.manager)
    const { draftId } = await startedDraft(w, { rounds: 1 })
    expect(await auditRows()).toHaveLength(1)
    const again = await inTx((tx) =>
      startDraft(tx, { draftId, actor: manager })
    )
    expect(again.success).toBe(false)
    expect((await auditRows()).map((r) => r.action)).toEqual(["draft.start"])
  })
})

describe("retention of the draft log", () => {
  const DAY = 24 * 60 * 60 * 1000
  const age = (draftId: string, days: number) =>
    db
      .update(drafts)
      .set({ updatedAt: new Date(Date.now() - days * DAY) })
      .where(eq(drafts.id, draftId))
  const typesOf = async (draftId: string) =>
    (
      await db
        .select({ type: draftEvents.type })
        .from(draftEvents)
        .where(eq(draftEvents.draftId, draftId))
        .orderBy(asc(draftEvents.seq))
    ).map((r) => r.type)

  it("purges the log of an old cancelled or applied draft, but keeps the start", async () => {
    const manager = await w.actorOf(w.manager)
    const { draftId: cancelled } = await startedDraft(w, { rounds: 1 })
    await inTx((tx) => cancelDraft(tx, { draftId: cancelled, actor: manager }))
    expect(await typesOf(cancelled)).toEqual([
      "created",
      "started",
      "cancelled",
    ])
    await age(cancelled, EVENT_AUDIT_RETENTION_DAYS + 5)

    const deleted = await purgeExpiredDraftLogs()
    expect(deleted).toBeGreaterThanOrEqual(2)
    // The `started` event carries the pick order and stays.
    expect(await typesOf(cancelled)).toEqual(["started"])
  })

  it("keeps the log of a live or recent draft", async () => {
    const manager = await w.actorOf(w.manager)
    const { draftId: live } = await startedDraft(w, { rounds: 1 })
    await age(live, EVENT_AUDIT_RETENTION_DAYS + 5)
    const before = await typesOf(live)
    await purgeExpiredDraftLogs()
    // Old, but still running: its log is needed.
    expect(await typesOf(live)).toEqual(before)

    await inTx((tx) => cancelDraft(tx, { draftId: live, actor: manager }))
    // Cancelled just now: inside the window.
    await purgeExpiredDraftLogs()
    expect(await typesOf(live)).toContain("cancelled")
  })

  it("honours the retention window it is given", async () => {
    const manager = await w.actorOf(w.manager)
    const { draftId } = await startedDraft(w, { rounds: 1 })
    await inTx((tx) => cancelDraft(tx, { draftId, actor: manager }))
    await age(draftId, 10)
    await purgeExpiredDraftLogs(new Date(), 30)
    expect(await typesOf(draftId)).toContain("cancelled")
    await purgeExpiredDraftLogs(new Date(), 7)
    expect(await typesOf(draftId)).toEqual(["started"])
  })

  it("purges the log of an applied draft", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1 })
    await db
      .update(drafts)
      .set({
        status: "complete",
        appliedAt: new Date(Date.now() - 400 * DAY),
        updatedAt: new Date(Date.now() - 400 * DAY),
      })
      .where(eq(drafts.id, draftId))
    await purgeExpiredDraftLogs()
    expect(await typesOf(draftId)).toEqual(["started"])
  })

  it("anonymises the actor of a user's draft log rows and keeps the rows", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1 })
    const before = await db
      .select()
      .from(draftEvents)
      .where(eq(draftEvents.draftId, draftId))
    expect(before.some((e) => e.actorUserId === w.manager)).toBe(true)

    const changed = await anonymiseDraftActor(w.manager)
    expect(changed).toBeGreaterThanOrEqual(2)
    const after = await db
      .select()
      .from(draftEvents)
      .where(
        and(
          eq(draftEvents.draftId, draftId),
          inArray(
            draftEvents.id,
            before.map((e) => e.id)
          )
        )
      )
    expect(after).toHaveLength(before.length)
    expect(after.every((e) => e.actorUserId !== w.manager)).toBe(true)
  })
})
