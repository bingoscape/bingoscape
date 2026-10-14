/**
 * @jest-environment node
 *
 * Migration 0041 (team draft 1/4, #215) applied to a real Postgres database
 * brought to the state of migration 0040: additive only, idempotent, and the
 * previous app version keeps working against it. Each test gets its own
 * throwaway database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0041_team_draft"
const PREVIOUS = "0040_credential_session_hygiene"

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

const DRAFT_TABLES = [
  "bingoscape-next_draft",
  "bingoscape-next_draft_team_slot",
  "bingoscape-next_draft_pool_entry",
  "bingoscape-next_draft_pick",
  "bingoscape-next_draft_event",
]

async function tables() {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`
  return rows.map((r) => r.table_name)
}

async function columnsOf(table: string) {
  const rows = await sql<{ column_name: string; is_nullable: string }[]>`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position`
  return rows
}

async function seedEvent() {
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email) VALUES ('u', 'u@example.test') RETURNING id`
  const [event] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
    VALUES ('e', now(), now() + interval '1 day', ${user!.id}) RETURNING id`
  return { userId: user!.id, eventId: event!.id }
}

describe("migration 0041", () => {
  it("only adds the five draft tables and leaves every existing table alone", async () => {
    const before = await tables()
    const teamsBefore = await columnsOf("bingoscape-next_teams")
    const membersBefore = await columnsOf("bingoscape-next_team_members")
    const participantsBefore = await columnsOf(
      "bingoscape-next_event_participants"
    )

    await mig.apply(MIGRATION)

    const after = await tables()
    expect(after.filter((t) => !before.includes(t)).sort()).toEqual(
      [...DRAFT_TABLES].sort()
    )
    expect(before.every((t) => after.includes(t))).toBe(true)
    expect(await columnsOf("bingoscape-next_teams")).toEqual(teamsBefore)
    expect(await columnsOf("bingoscape-next_team_members")).toEqual(
      membersBefore
    )
    expect(await columnsOf("bingoscape-next_event_participants")).toEqual(
      participantsBefore
    )
  })

  it("is idempotent: a second run changes nothing and does not fail", async () => {
    await mig.apply(MIGRATION)
    const first = await tables()
    const constraints = await sql`
      SELECT conname FROM pg_constraint ORDER BY conname`
    const indexes =
      await sql`SELECT indexname FROM pg_indexes ORDER BY indexname`
    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(await tables()).toEqual(first)
    expect(
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    ).toEqual(constraints)
    expect(
      await sql`SELECT indexname FROM pg_indexes ORDER BY indexname`
    ).toEqual(indexes)
  })

  it("keeps the previous app version working: team_members writes without a draft", async () => {
    await mig.apply(MIGRATION)
    const { userId, eventId } = await seedEvent()
    const [team] = await sql<{ id: string }[]>`
      INSERT INTO "bingoscape-next_teams" (event_id, name) VALUES (${eventId}, 't') RETURNING id`
    // The previous version inserts team_members without event_id.
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, user_id) VALUES (${team!.id}, ${userId})`
    ).resolves.toBeDefined()
    // And deleting an Event or a Team is unaffected by the draft tables.
    await sql`DELETE FROM "bingoscape-next_teams" WHERE id = ${team!.id}`
    await sql`DELETE FROM "bingoscape-next_events" WHERE id = ${eventId}`
  })

  it("enforces the CHECK constraints and the one-live-draft-per-Event index", async () => {
    await mig.apply(MIGRATION)
    const { eventId } = await seedEvent()
    const insert = (status: string, rounds = 1) =>
      sql`INSERT INTO "bingoscape-next_draft" (event_id, status, rounds) VALUES (${eventId}, ${status}, ${rounds})`

    await expect(insert("nonsense")).rejects.toThrow(/draft_status_check/)
    await expect(insert("setup", 0)).rejects.toThrow(/draft_rounds_check/)
    await expect(
      sql`INSERT INTO "bingoscape-next_draft" (event_id, rounds, order_type) VALUES (${eventId}, 1, 'zigzag')`
    ).rejects.toThrow(/draft_order_type_check/)
    await expect(
      sql`INSERT INTO "bingoscape-next_draft" (event_id, rounds, on_timeout) VALUES (${eventId}, 1, 'explode')`
    ).rejects.toThrow(/draft_on_timeout_check/)
    await expect(
      sql`INSERT INTO "bingoscape-next_draft" (event_id, rounds, pick_timer_seconds) VALUES (${eventId}, 1, 0)`
    ).rejects.toThrow(/draft_pick_timer_check/)

    await insert("setup")
    await expect(insert("in_progress")).rejects.toThrow(
      /draft_event_active_unique/
    )
    await sql`UPDATE "bingoscape-next_draft" SET status = 'cancelled'`
    await expect(insert("setup")).resolves.toBeDefined()
  })

  it("cascades the draft away with its Event", async () => {
    await mig.apply(MIGRATION)
    const { eventId, userId } = await seedEvent()
    const [draft] = await sql<{ id: string }[]>`
      INSERT INTO "bingoscape-next_draft" (event_id, rounds, created_by) VALUES (${eventId}, 1, ${userId}) RETURNING id`
    await sql`INSERT INTO "bingoscape-next_draft_event" (draft_id, type) VALUES (${draft!.id}, 'created')`
    await sql`DELETE FROM "bingoscape-next_events" WHERE id = ${eventId}`
    const rows = await sql`SELECT 1 FROM "bingoscape-next_draft_event"`
    expect(rows).toHaveLength(0)
  })

  it("lets a user be erased: user references on the draft tables are set to NULL", async () => {
    await mig.apply(MIGRATION)
    const { eventId, userId } = await seedEvent()
    const [draft] = await sql<{ id: string }[]>`
      INSERT INTO "bingoscape-next_draft" (event_id, rounds, created_by) VALUES (${eventId}, 1, ${userId}) RETURNING id`
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${userId}`
    const [row] = await sql<{ created_by: string | null }[]>`
      SELECT created_by FROM "bingoscape-next_draft" WHERE id = ${draft!.id}`
    expect(row!.created_by).toBeNull()
  })
})
