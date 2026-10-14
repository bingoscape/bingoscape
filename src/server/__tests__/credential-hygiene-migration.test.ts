/**
 * @jest-environment node
 *
 * Migration 0040 (RBAC 7/8) applied to a real Postgres database that is first
 * brought to the state of migration 0039 and seeded the way the previous app
 * version leaves it. Each test gets its own throwaway database.
 */
import postgres from "postgres"

import { hashApiKey } from "@/lib/api-key"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0040_credential_session_hygiene"
const PREVIOUS = "0039_rbac_role_change_trigger"

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

async function user(name: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email) VALUES (${name}, ${`${name}@example.test`})
    RETURNING id`
  return row!.id
}

/** What the previous app version does: insert with the plaintext key only. */
async function legacyKey(userId: string, key: string) {
  await sql`
    INSERT INTO "bingoscape-next_api_keys" (user_id, name, key) VALUES (${userId}, 'legacy', ${key})`
}

const keys = () =>
  sql<
    {
      key: string | null
      key_hash: string | null
      key_prefix: string | null
      scopes: string[]
      expires_at: Date | null
      revoked_at: Date | null
    }[]
  >`SELECT key, key_hash, key_prefix, scopes, expires_at, revoked_at
    FROM "bingoscape-next_api_keys" ORDER BY key NULLS LAST`

describe("migration 0040", () => {
  it("backfills hash and prefix of existing keys, keeps the plaintext, adds defaults", async () => {
    const owner = await user("owner")
    await legacyKey(owner, "bsn_abcdefghijklmnopqrstuvwxyz012345")
    await legacyKey(owner, "bsn_second-key-with-umlaut-äö")

    await mig.apply(MIGRATION)

    const rows = await keys()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.key).not.toBeNull()
      // Same hash the app computes (src/lib/api-key.ts).
      expect(row.key_hash).toBe(hashApiKey(row.key!))
      expect(row.key_prefix).toBe(row.key!.slice(0, 8))
      expect(row.scopes).toEqual(["read", "submit"])
      expect(row.expires_at).toBeNull()
      expect(row.revoked_at).toBeNull()
    }
  })

  it("is idempotent: a second run changes nothing and does not fail", async () => {
    const owner = await user("owner")
    await legacyKey(owner, "bsn_idempotent")
    await mig.apply(MIGRATION)
    const first = await keys()

    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()

    expect(await keys()).toEqual(first)
  })

  it("keeps the previous app working: it inserts keys without hash, scopes or expiry", async () => {
    await mig.apply(MIGRATION)
    const owner = await user("owner")

    await legacyKey(owner, "bsn_inserted-by-old-app")

    const [row] = await keys()
    expect(row).toMatchObject({
      key: "bsn_inserted-by-old-app",
      key_hash: null,
      scopes: ["read", "submit"],
    })
    // Its read path (WHERE key = ...) still works.
    const found = await sql`
      SELECT id FROM "bingoscape-next_api_keys" WHERE key = 'bsn_inserted-by-old-app'`
    expect(found).toHaveLength(1)
  })

  it("lets new keys leave the legacy column empty, many of them", async () => {
    await mig.apply(MIGRATION)
    const owner = await user("owner")

    for (const h of ["a".repeat(64), "b".repeat(64)]) {
      await sql`
        INSERT INTO "bingoscape-next_api_keys" (user_id, name, key_hash, key_prefix)
        VALUES (${owner}, 'new', ${h}, 'bsn_abcd')`
    }

    expect((await keys()).filter((k) => k.key === null)).toHaveLength(2)
  })

  it("keeps the hash unique", async () => {
    await mig.apply(MIGRATION)
    const owner = await user("owner")
    const insert = () => sql`
      INSERT INTO "bingoscape-next_api_keys" (user_id, name, key_hash)
      VALUES (${owner}, 'dup', ${"c".repeat(64)})`
    await insert()
    await expect(insert()).rejects.toThrow(/api_keys_key_hash_unique/)
  })

  it("adds nullable session and verified-email columns to users", async () => {
    const before = await user("before")
    await mig.apply(MIGRATION)

    const [row] = await sql<
      { session_revoked_at: Date | null; provider_verified_email: string | null }[]
    >`SELECT session_revoked_at, provider_verified_email FROM "bingoscape-next_user" WHERE id = ${before}`
    expect(row).toEqual({ session_revoked_at: null, provider_verified_email: null })

    // The previous app inserts users without the new columns.
    await expect(user("after")).resolves.toEqual(expect.any(String))
  })
})
