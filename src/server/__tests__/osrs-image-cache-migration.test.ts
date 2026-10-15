/**
 * @jest-environment node
 *
 * Migration 0044 (wiki image cache 1/6, #227) applied to a real Postgres
 * database brought to the state of migration 0043: one new table, nothing else
 * touched, idempotent, and the table matches the Drizzle schema. Each test gets
 * its own throwaway database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0044_osrs_image_cache"
const PREVIOUS = "0043_team_draft_discord"
const TABLE = "bingoscape-next_osrs_image_cache"

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

async function tables() {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`
  return rows.map((r) => r.table_name)
}

async function columns(table: string) {
  return sql<
    {
      column_name: string
      is_nullable: string
      column_default: string | null
    }[]
  >`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position`
}

describe("migration 0044", () => {
  it("only adds the osrs_image_cache table", async () => {
    const before = await tables()
    await mig.apply(MIGRATION)
    const after = await tables()
    expect(after.filter((t) => !before.includes(t))).toEqual([TABLE])
    expect(before.filter((t) => !after.includes(t))).toEqual([])
  })

  it("creates the columns of the issue, with key as primary key", async () => {
    await mig.apply(MIGRATION)
    const cols = await columns(TABLE)
    expect(cols.map((c) => c.column_name)).toEqual([
      "key",
      "status",
      "file_name",
      "content_type",
      "bytes",
      "etag",
      "last_modified",
      "fetched_at",
      "refreshed_at",
      "attempts",
      "retry_after",
      "created_at",
    ])
    const pk = await sql<{ column_name: string }[]>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = ${TABLE}
        AND tc.constraint_type = 'PRIMARY KEY'`
    expect(pk.map((r) => r.column_name)).toEqual(["key"])
  })

  it("defaults attempts and created_at and restricts status", async () => {
    await mig.apply(MIGRATION)
    await sql.unsafe(
      `INSERT INTO "${TABLE}" ("key", "status") VALUES ('Giant_frog.png', 'ok')`
    )
    const [row] = await sql<{ attempts: number; created_at: Date | null }[]>`
      SELECT attempts, created_at FROM ${sql(TABLE)} WHERE key = 'Giant_frog.png'`
    expect(row?.attempts).toBe(0)
    expect(row?.created_at).toBeInstanceOf(Date)

    await expect(
      sql.unsafe(
        `INSERT INTO "${TABLE}" ("key", "status") VALUES ('x.png', 'bogus')`
      )
    ).rejects.toThrow(/osrs_image_cache_status_check/)
    await expect(
      sql.unsafe(
        `INSERT INTO "${TABLE}" ("key", "status") VALUES ('Giant_frog.png', 'error')`
      )
    ).rejects.toThrow(/duplicate key/)
  })

  it("is idempotent and keeps existing rows", async () => {
    await mig.apply(MIGRATION)
    await sql.unsafe(
      `INSERT INTO "${TABLE}" ("key", "status") VALUES ('Giant_frog.png', 'ok')`
    )
    const constraints =
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(
      await sql`SELECT conname FROM pg_constraint ORDER BY conname`
    ).toEqual(constraints)
    const rows = await sql.unsafe(`SELECT "key" FROM "${TABLE}"`)
    expect(rows).toHaveLength(1)
  })
})
