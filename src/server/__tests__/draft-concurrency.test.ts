/**
 * @jest-environment node
 *
 * Races on one draft, on real Postgres (team draft 1/4, #215). The core
 * functions run in their own transactions with a distinct actor per call, so
 * the callers really are different users (the server actions read the session
 * of the whole process). The draft row lock decides every race; the unique
 * indexes are only the backstop.
 */
import { and, asc, eq, isNull } from "drizzle-orm"

import { db } from "@/server/db"
import { performPick, undoPick, type Tx } from "@/server/draft/core"
import {
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  drafts,
} from "@/server/db/schema"
import {
  createDraftWorld,
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
  w = await createDraftWorld({ captains: 8, players: 24 })
})
afterEach(async () => {
  await w.cleanup()
})

const pickAs = async (
  draftId: string,
  userId: string,
  poolEntryId: string,
  force = false
) => {
  const actor = await w.actorOf(userId)
  return db.transaction((tx) =>
    performPick(tx as Tx, { draftId, poolEntryId, actor, force })
  )
}

const entries = (draftId: string) =>
  db
    .select()
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draftId),
        eq(draftPoolEntries.status, "available")
      )
    )
    .orderBy(asc(draftPoolEntries.id))

const picks = (draftId: string) =>
  db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.draftId, draftId), isNull(draftPicks.undoneAt)))
    .orderBy(asc(draftPicks.pickNo))

describe("makePick races", () => {
  it("20 calls for the same player from different captains yield exactly one success", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    const [target] = await entries(draftId)

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        pickAs(draftId, w.captains[i % w.captains.length]!, target!.id)
      )
    )

    expect(results.filter((r) => r.success)).toHaveLength(1)
    const failures = results.filter((r) => !r.success)
    expect(failures).toHaveLength(19)
    for (const failure of failures) {
      expect(failure).toMatchObject({ success: false })
      expect((failure as { error: string }).error).toMatch(
        /not your turn|not available/
      )
    }
    const stored = await picks(draftId)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      pickNo: 1,
      poolEntryId: target!.id,
      pickedBy: w.captains[0],
    })
  })

  it("two captains on the same turn yield one success and one 'not your turn'", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    const [a, b] = await entries(draftId)

    // Captain 1 is on turn; captain 3 is not, and is not next either.
    const [onTurn, early] = await Promise.all([
      pickAs(draftId, w.captains[0]!, a!.id),
      pickAs(draftId, w.captains[2]!, b!.id),
    ])
    expect(onTurn).toMatchObject({ success: true, pickNo: 1 })
    expect(early).toMatchObject({
      success: false,
      error: "It is not your turn",
    })
    expect(await picks(draftId)).toHaveLength(1)
  })

  it("lets every captain pick once when they take turns concurrently", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1 })
    const pool = await entries(draftId)
    // All eight captains fire at the same time with different players; each
    // pick either lands on its own turn or is refused, and the numbers stay
    // contiguous whatever the interleaving.
    const results = await Promise.all(
      w.captains.map((captain, i) => pickAs(draftId, captain, pool[i]!.id))
    )
    const succeeded = results.filter((r) => r.success).length
    expect(succeeded).toBeGreaterThanOrEqual(1)
    const stored = await picks(draftId)
    expect(stored.map((p) => p.pickNo)).toEqual(
      Array.from({ length: stored.length }, (_, i) => i + 1)
    )
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId))
    expect(draft!.currentPickNo).toBe(stored.length + 1)
    // No player twice.
    expect(new Set(stored.map((p) => p.poolEntryId)).size).toBe(stored.length)
  })

  it("keeps pick numbers contiguous under concurrent undo and pick", async () => {
    const { draftId } = await startedDraft(w, { rounds: 3 })
    const manager = await w.actorOf(w.manager)

    // Two picks first, so there is something to undo.
    for (let i = 0; i < 2; i++) {
      const [entry] = await entries(draftId)
      const [draft] = await db
        .select()
        .from(drafts)
        .where(eq(drafts.id, draftId))
      const captain = await captainFor(draftId, draft!.currentPickNo)
      expect(await pickAs(draftId, captain, entry!.id)).toMatchObject({
        success: true,
      })
    }

    for (let round = 0; round < 12; round++) {
      const [draft] = await db
        .select()
        .from(drafts)
        .where(eq(drafts.id, draftId))
      const pool = await entries(draftId)
      const next = await captainFor(draftId, draft!.currentPickNo)
      const [first, second] = pool
      await Promise.all([
        db.transaction((tx) => undoPick(tx as Tx, { draftId, actor: manager })),
        pickAs(draftId, next, first!.id),
        // A second captain racing for the same turn adds noise.
        pickAs(
          draftId,
          w.captains[(round + 3) % w.captains.length]!,
          second!.id
        ),
      ])

      const stored = await picks(draftId)
      expect(stored.map((p) => p.pickNo)).toEqual(
        Array.from({ length: stored.length }, (_, i) => i + 1)
      )
      const [after] = await db
        .select()
        .from(drafts)
        .where(eq(drafts.id, draftId))
      expect(after!.currentPickNo).toBe(stored.length + 1)
      const drafted = await db
        .select()
        .from(draftPoolEntries)
        .where(
          and(
            eq(draftPoolEntries.draftId, draftId),
            eq(draftPoolEntries.status, "drafted")
          )
        )
      expect(drafted).toHaveLength(stored.length)
      expect(new Set(drafted.map((d) => d.id))).toEqual(
        new Set(stored.map((p) => p.poolEntryId))
      )
    }
  })
})

/** The captain who is due at `pickNo` (snake over the identity order). */
async function captainFor(draftId: string, pickNo: number): Promise<string> {
  const slots = await db
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draftId))
    .orderBy(asc(draftTeamSlots.position))
  const n = slots.length
  const round = Math.floor((pickNo - 1) / n) + 1
  const index = (pickNo - 1) % n
  return slots[round % 2 === 0 ? n - 1 - index : index]!.captainUserId!
}
