/**
 * @jest-environment node
 *
 * Migration 0042 (team draft 3/4, #217) applied to a real Postgres database
 * brought to the state of migration 0041: additive, idempotent, and the
 * previous app version keeps working. Each test gets its own throwaway
 * database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0042_team_draft_timer"
const PREVIOUS = "0041_team_draft"

let mig: MigrationDb
let sql: postgres.Sql

beforeEach(async () => {
  mig = await createMigrationDb()
  sql = mig.sql
  await mig.applyThrough(PREVIOUS)
})
afterEach(async () => {
  await mig.close()
})

async function columnNames(table: string) {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name`
  return rows.map((r) => r.column_name)
}

async function tables() {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`
  return rows.map((r) => r.table_name)
}

/** A draft with one slot, two pool entries and (optionally) the first pick. */
async function seedDraft() {
  const email = `u-${Math.random().toString(36).slice(2)}@example.test`
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email) VALUES ('u', ${email}) RETURNING id`
  const [event] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
    VALUES ('e', now(), now() + interval '1 day', ${user!.id}) RETURNING id`
  const [draft] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_draft" (event_id, rounds) VALUES (${event!.id}, 2) RETURNING id`
  const [slot] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_draft_team_slot" (draft_id, event_id, team_name, position, max_team_size)
    VALUES (${draft!.id}, ${event!.id}, 'A', 0, 3) RETURNING id`
  const entries = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_draft_pool_entry" (draft_id, event_id, rating_source)
    VALUES (${draft!.id}, ${event!.id}, 'x'), (${draft!.id}, ${event!.id}, 'x') RETURNING id`
  return {
    draftId: draft!.id,
    slotId: slot!.id,
    entryA: entries[0]!.id,
    entryB: entries[1]!.id,
  }
}

describe("migration 0042", () => {
  it("only adds the queue table and three columns", async () => {
    const before = await tables()
    const draftBefore = await columnNames("bingoscape-next_draft")
    const slotBefore = await columnNames("bingoscape-next_draft_team_slot")
    const pickBefore = await columnNames("bingoscape-next_draft_pick")

    await mig.apply(MIGRATION)

    const after = await tables()
    expect(after.filter((t) => !before.includes(t))).toEqual([
      "bingoscape-next_draft_queue_entry",
    ])
    expect(before.every((t) => after.includes(t))).toBe(true)
    const added = async (table: string, was: string[]) =>
      (await columnNames(table)).filter((c) => !was.includes(c))
    expect(await added("bingoscape-next_draft", draftBefore)).toEqual([
      "paused_remaining_ms",
    ])
    expect(await added("bingoscape-next_draft_team_slot", slotBefore)).toEqual([
      "consecutive_timeouts",
    ])
    expect(await added("bingoscape-next_draft_pick", pickBefore)).toEqual([
      "undone_at",
    ])
  })

  it("is idempotent: a second run changes nothing and does not fail", async () => {
    await mig.apply(MIGRATION)
    const constraints = await sql`
      SELECT conname FROM pg_constraint ORDER BY conname`
    const indexes = await sql`
      SELECT indexname, indexdef FROM pg_indexes ORDER BY indexname`
    const columns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' ORDER BY table_name, column_name`
    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    ).toEqual(constraints)
    expect(
      await sql`SELECT indexname, indexdef FROM pg_indexes ORDER BY indexname`
    ).toEqual(indexes)
    expect(
      await sql`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' ORDER BY table_name, column_name`
    ).toEqual(columns)
  })

  it("keeps existing rows and gives the new columns their defaults", async () => {
    const { draftId, slotId } = await seedDraft()
    await mig.apply(MIGRATION)
    const [draft] = await sql<{ paused_remaining_ms: number | null }[]>`
      SELECT paused_remaining_ms FROM "bingoscape-next_draft" WHERE id = ${draftId}`
    expect(draft!.paused_remaining_ms).toBeNull()
    const [slot] = await sql<{ consecutive_timeouts: number }[]>`
      SELECT consecutive_timeouts FROM "bingoscape-next_draft_team_slot" WHERE id = ${slotId}`
    expect(slot!.consecutive_timeouts).toBe(0)
  })

  it("makes the pick indexes partial: an undone pick frees its number and its player", async () => {
    const { draftId, slotId, entryA, entryB } = await seedDraft()
    await mig.apply(MIGRATION)
    const insert = (pickNo: number, entry: string) =>
      sql`INSERT INTO "bingoscape-next_draft_pick" (draft_id, pick_no, round, slot_id, pool_entry_id)
          VALUES (${draftId}, ${pickNo}, 1, ${slotId}, ${entry})`

    await insert(1, entryA)
    // Still unique while the pick stands.
    await expect(insert(1, entryB)).rejects.toThrow(
      /draft_pick_draft_pick_no_unique/
    )
    await expect(insert(2, entryA)).rejects.toThrow(
      /draft_pick_draft_pool_entry_unique/
    )

    await sql`UPDATE "bingoscape-next_draft_pick" SET undone_at = now() WHERE draft_id = ${draftId}`
    // The undone row no longer blocks the number or the player.
    await expect(insert(1, entryB)).resolves.toBeDefined()
    await expect(insert(2, entryA)).resolves.toBeDefined()
    const rows = await sql`
      SELECT 1 FROM "bingoscape-next_draft_pick" WHERE draft_id = ${draftId}`
    expect(rows).toHaveLength(3)
  })

  it("keeps the previous app version working: it hard-deletes on undo and never sets undone_at", async () => {
    const { draftId, slotId, entryA } = await seedDraft()
    await mig.apply(MIGRATION)
    const insert = () =>
      sql`INSERT INTO "bingoscape-next_draft_pick" (draft_id, pick_no, round, slot_id, pool_entry_id)
          VALUES (${draftId}, 1, 1, ${slotId}, ${entryA})`
    await insert()
    await expect(insert()).rejects.toThrow(/draft_pick_draft_pick_no_unique/)
    await sql`DELETE FROM "bingoscape-next_draft_pick" WHERE draft_id = ${draftId}`
    await expect(insert()).resolves.toBeDefined()
  })

  it("enforces the new CHECK constraints and keeps queue entries inside their draft", async () => {
    const { draftId, slotId, entryA } = await seedDraft()
    await mig.apply(MIGRATION)
    await expect(
      sql`UPDATE "bingoscape-next_draft" SET paused_remaining_ms = -1 WHERE id = ${draftId}`
    ).rejects.toThrow(/draft_paused_remaining_check/)
    await expect(
      sql`UPDATE "bingoscape-next_draft_team_slot" SET consecutive_timeouts = -1 WHERE id = ${slotId}`
    ).rejects.toThrow(/draft_team_slot_consecutive_timeouts_check/)
    await expect(
      sql`INSERT INTO "bingoscape-next_draft_queue_entry" (draft_id, slot_id, pool_entry_id, position)
          VALUES (${draftId}, ${slotId}, ${entryA}, -1)`
    ).rejects.toThrow(/draft_queue_entry_position_check/)

    await sql`INSERT INTO "bingoscape-next_draft_queue_entry" (draft_id, slot_id, pool_entry_id, position)
              VALUES (${draftId}, ${slotId}, ${entryA}, 0)`
    await expect(
      sql`INSERT INTO "bingoscape-next_draft_queue_entry" (draft_id, slot_id, pool_entry_id, position)
          VALUES (${draftId}, ${slotId}, ${entryA}, 1)`
    ).rejects.toThrow(/draft_queue_entry_slot_entry_unique/)
    // A pool entry of another draft is refused by the composite foreign key.
    const other = await seedDraft()
    await expect(
      sql`INSERT INTO "bingoscape-next_draft_queue_entry" (draft_id, slot_id, pool_entry_id, position)
          VALUES (${draftId}, ${slotId}, ${other.entryA}, 2)`
    ).rejects.toThrow(/draft_queue_entry_pool_entry_draft_fk/)
  })
})
