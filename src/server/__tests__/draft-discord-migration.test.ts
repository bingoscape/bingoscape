/**
 * @jest-environment node
 *
 * Migration 0043 (team draft 4/4, #218) applied to a real Postgres database
 * brought to the state of migration 0042: one defaulted column, backfilled so
 * a deploy never posts history to Discord, idempotent, and the previous app
 * version keeps working. Each test gets its own throwaway database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0043_team_draft_discord"
const PREVIOUS = "0042_team_draft_timer"

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

async function seedDraft(events: number) {
  const email = `u-${Math.random().toString(36).slice(2)}@example.test`
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email) VALUES ('u', ${email}) RETURNING id`
  const [event] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
    VALUES ('e', now(), now() + interval '1 day', ${user!.id}) RETURNING id`
  const [draft] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_draft" (event_id, rounds) VALUES (${event!.id}, 2) RETURNING id`
  for (let i = 0; i < events; i += 1) {
    await sql`INSERT INTO "bingoscape-next_draft_event" (draft_id, type)
              VALUES (${draft!.id}, 'created')`
  }
  const [last] = await sql<{ seq: string }[]>`
    SELECT max(seq)::text AS seq FROM "bingoscape-next_draft_event" WHERE draft_id = ${draft!.id}`
  return { draftId: draft!.id, lastSeq: Number(last!.seq ?? 0) }
}

const cursorOf = async (draftId: string) => {
  const [row] = await sql<{ discord_posted_seq: string }[]>`
    SELECT discord_posted_seq::text FROM "bingoscape-next_draft" WHERE id = ${draftId}`
  return Number(row!.discord_posted_seq)
}

describe("migration 0043", () => {
  it("only adds one column to draft", async () => {
    const before = await tables()
    const draftBefore = await columnNames("bingoscape-next_draft")
    await mig.apply(MIGRATION)
    expect(await tables()).toEqual(before)
    expect(
      (await columnNames("bingoscape-next_draft")).filter(
        (c) => !draftBefore.includes(c)
      )
    ).toEqual(["discord_posted_seq"])
  })

  it("backfills existing drafts to their last event so history is not posted", async () => {
    const withEvents = await seedDraft(3)
    const without = await seedDraft(0)
    await mig.apply(MIGRATION)
    expect(await cursorOf(withEvents.draftId)).toBe(withEvents.lastSeq)
    expect(withEvents.lastSeq).toBeGreaterThan(0)
    expect(await cursorOf(without.draftId)).toBe(0)
  })

  it("is idempotent and never moves the cursor back", async () => {
    const { draftId, lastSeq } = await seedDraft(2)
    await mig.apply(MIGRATION)
    await sql`INSERT INTO "bingoscape-next_draft_event" (draft_id, type) VALUES (${draftId}, 'created')`
    const constraints =
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    ).toEqual(constraints)
    // The re-run did not backfill again: the third event is still unposted.
    expect(await cursorOf(draftId)).toBe(lastSeq)
  })

  it("rejects a negative cursor and keeps the previous app version working", async () => {
    await mig.apply(MIGRATION)
    const { draftId } = await seedDraft(0)
    await expect(
      sql`UPDATE "bingoscape-next_draft" SET discord_posted_seq = -1 WHERE id = ${draftId}`
    ).rejects.toThrow(/draft_discord_posted_seq_check/)
    // The previous version inserts a draft without naming the column.
    expect(await cursorOf(draftId)).toBe(0)
  })
})
