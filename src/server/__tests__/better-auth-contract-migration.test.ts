/**
 * @jest-environment node
 *
 * Migration 0047 (Better Auth 4b, contract phase, epic #250, issue #260) applied to a real
 * Postgres database that is first brought to the state of migration 0046 and
 * seeded the way the NextAuth and Better Auth apps leave it. Each test gets its
 * own throwaway database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0047_better_auth_contract"
const PREVIOUS = "0046_better_auth_expand"

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

/** A user as the NextAuth app wrote it (hash on the user row). */
async function user(name: string, password: string | null = null) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, username, password)
    VALUES (${name}, ${password ? name : null}, ${password})
    RETURNING id`
  return row!.id
}

async function oldAccount(userId: string, providerAccountId: string) {
  await sql`
    INSERT INTO "bingoscape-next_account"
      (user_id, type, provider, provider_account_id, access_token, expires_at)
    VALUES (${userId}, 'oauth', 'discord', ${providerAccountId}, 'at', 1800000000)`
}

const authAccounts = () =>
  sql<
    {
      user_id: string
      provider_id: string
      account_id: string
      password: string | null
    }[]
  >`
    SELECT user_id, provider_id, account_id, password
    FROM "bingoscape-next_auth_account" ORDER BY provider_id, account_id`

const tableExists = async (table: string) =>
  (
    await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ${table}`
  ).length > 0

const columnExists = async (column: string) =>
  (
    await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'bingoscape-next_user'
        AND column_name = ${column}`
  ).length > 0

const OLD_TABLES = [
  "bingoscape-next_account",
  "bingoscape-next_session",
  "bingoscape-next_verification_token",
]
const OLD_COLUMNS = ["password", "session_revoked_at", "email_verified"]

describe("migration 0047", () => {
  it("drops the NextAuth tables and user columns once everything is in auth_account", async () => {
    const pw = await user("pw", "$2b$12$pw")
    const oauth = await user("oauth")
    await oldAccount(oauth, "d-1")
    await sql`
      INSERT INTO "bingoscape-next_session" (session_token, user_id, expires)
      VALUES ('old', ${oauth}, now() - interval '1 day')`
    await mig.apply(PREVIOUS) // the copy, as at the cutover

    await mig.apply(MIGRATION)

    for (const t of OLD_TABLES) expect(await tableExists(t)).toBe(false)
    for (const c of OLD_COLUMNS) expect(await columnExists(c)).toBe(false)
    expect(await columnExists("is_email_verified")).toBe(true)
    expect(await authAccounts()).toEqual([
      {
        user_id: pw,
        provider_id: "credential",
        account_id: pw,
        password: "$2b$12$pw",
      },
      {
        user_id: oauth,
        provider_id: "discord",
        account_id: "d-1",
        password: null,
      },
    ])
  })

  it("copies a password and an OAuth account missing from auth_account before the drop", async () => {
    // Written by the NextAuth app after 0046 ran (e.g. a rolled-back release).
    const pw = await user("late-pw", "$2b$12$late")
    const oauth = await user("late-oauth")
    await oldAccount(oauth, "d-late")
    expect(await authAccounts()).toEqual([])

    await mig.apply(MIGRATION)

    expect(await authAccounts()).toEqual([
      {
        user_id: pw,
        provider_id: "credential",
        account_id: pw,
        password: "$2b$12$late",
      },
      {
        user_id: oauth,
        provider_id: "discord",
        account_id: "d-late",
        password: null,
      },
    ])
    const [token] = await sql<
      { access_token: string; access_token_expires_at: Date }[]
    >`
      SELECT access_token, access_token_expires_at FROM "bingoscape-next_auth_account"
      WHERE account_id = 'd-late'`
    expect(token).toEqual({
      access_token: "at",
      access_token_expires_at: new Date(1800000000 * 1000),
    })
    expect(await tableExists("bingoscape-next_account")).toBe(false)
    expect(await columnExists("password")).toBe(false)
  })

  it("keeps an account the Better Auth app already has, without overwriting it", async () => {
    const id = await user("changed", "$2b$12$old")
    await mig.apply(PREVIOUS)
    // Changed in the Better Auth app after the cutover.
    await sql`
      UPDATE "bingoscape-next_auth_account" SET password = '$2b$12$new' WHERE user_id = ${id}`

    await mig.apply(MIGRATION)

    expect(await authAccounts()).toEqual([
      expect.objectContaining({ user_id: id, password: "$2b$12$new" }),
    ])
  })

  it("keeps users.password when a password cannot be copied", async () => {
    const id = await user("blocked", "$2b$12$only-here")
    // A credential row without a hash blocks the copy (it never overwrites).
    await sql`
      INSERT INTO "bingoscape-next_auth_account" (user_id, provider_id, account_id)
      VALUES (${id}, 'credential', ${id})`

    await mig.apply(MIGRATION)

    expect(await columnExists("password")).toBe(true)
    const [row] = await sql<{ password: string }[]>`
      SELECT password FROM "bingoscape-next_user" WHERE id = ${id}`
    expect(row!.password).toBe("$2b$12$only-here")
    // The rest of the contract still happens.
    for (const t of OLD_TABLES) expect(await tableExists(t)).toBe(false)
    expect(await columnExists("session_revoked_at")).toBe(false)
    expect(await columnExists("email_verified")).toBe(false)
    // A later run drops the column once the password is in place.
    await sql`
      UPDATE "bingoscape-next_auth_account" SET password = '$2b$12$only-here' WHERE user_id = ${id}`
    await mig.apply(MIGRATION)
    expect(await columnExists("password")).toBe(false)
  })

  it("is idempotent: a second run changes nothing and does not fail", async () => {
    const pw = await user("pw", "$2b$12$pw")
    await oldAccount(pw, "d-1")
    await mig.apply(MIGRATION)
    const first = await authAccounts()

    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()

    expect(await authAccounts()).toEqual(first)
    expect(first).toHaveLength(2)
  })

  it("leaves the same user and auth columns and indexes as `drizzle-kit push` of the schema", async () => {
    await mig.apply(MIGRATION)
    const tables = [
      ...OLD_TABLES,
      "bingoscape-next_user",
      "bingoscape-next_auth_account",
    ]
    const shape = async (client: postgres.Sql) => ({
      indexes: (
        await client<{ indexname: string }[]>`
          SELECT indexname FROM pg_indexes WHERE tablename IN ${client(tables)} ORDER BY indexname`
      ).map((x) => x.indexname),
      columns: (
        await client<{ c: string }[]>`
          SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable AS c
          FROM information_schema.columns WHERE table_name IN ${client(tables)} ORDER BY 1`
      ).map((x) => x.c),
    })
    const pushed = postgres(process.env.DATABASE_URL!, { max: 1 })
    try {
      expect(await shape(sql)).toEqual(await shape(pushed))
    } finally {
      await pushed.end()
    }
  })
})
