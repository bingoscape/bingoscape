/**
 * @jest-environment node
 *
 * Migration 0046 (Better Auth 2/4, epic #250) applied to a real Postgres
 * database that is first brought to the state of migration 0045 and seeded
 * the way the NextAuth app leaves it. Each test gets its own throwaway
 * database.
 */
import fs from "node:fs"
import path from "node:path"

import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0046_better_auth_expand"
const PREVIOUS = "0045_rbac_contract"
const SCRIPTS = path.resolve(__dirname, "../../../scripts")
const script = (name: string) =>
  fs.readFileSync(path.join(SCRIPTS, name), "utf8")

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

/** A user as NextAuth / registerUser create them (no Better Auth columns). */
async function user(
  name: string,
  opts: { email?: string | null; password?: string; verified?: string } = {}
) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email, username, password, provider_verified_email)
    VALUES (${name}, ${opts.email ?? null}, ${opts.password ? name : null},
      ${opts.password ?? null}, ${opts.verified ?? null})
    RETURNING id`
  return row!.id
}

async function discordAccount(userId: string, providerAccountId: string) {
  await sql`
    INSERT INTO "bingoscape-next_account"
      (user_id, type, provider, provider_account_id, access_token, refresh_token, expires_at, scope)
    VALUES (${userId}, 'oauth', 'discord', ${providerAccountId}, 'at', 'rt', 1800000000, 'identify email')`
}

const authAccounts = () =>
  sql<
    {
      user_id: string
      provider_id: string
      account_id: string
      access_token: string | null
      access_token_expires_at: Date | null
      password: string | null
    }[]
  >`SELECT user_id, provider_id, account_id, access_token, access_token_expires_at, password
    FROM "bingoscape-next_auth_account" ORDER BY provider_id, account_id`

async function seed() {
  const oauth = await user("oauth", {
    email: "oauth@example.test",
    verified: "oauth@example.test",
  })
  await discordAccount(oauth, "d-1")
  const noEmail = await user("noemail")
  await discordAccount(noEmail, "d-2")
  const pw = await user("pwuser", { password: "$2b$12$hash" })
  return { oauth, noEmail, pw }
}

describe("migration 0046", () => {
  it("copies OAuth accounts and passwords, and sets the verified flag", async () => {
    const { oauth, noEmail, pw } = await seed()

    await mig.apply(MIGRATION)

    expect(await authAccounts()).toEqual([
      {
        user_id: pw,
        provider_id: "credential",
        account_id: pw,
        access_token: null,
        access_token_expires_at: null,
        password: "$2b$12$hash",
      },
      {
        user_id: oauth,
        provider_id: "discord",
        account_id: "d-1",
        access_token: "at",
        access_token_expires_at: new Date(1800000000 * 1000),
        password: null,
      },
      expect.objectContaining({ user_id: noEmail, account_id: "d-2" }),
    ])
    const users = await sql<{ name: string; is_email_verified: boolean; email: string | null }[]>`
      SELECT name, is_email_verified, email FROM "bingoscape-next_user" ORDER BY name`
    expect(users).toEqual([
      { name: "noemail", is_email_verified: false, email: null },
      { name: "oauth", is_email_verified: true, email: "oauth@example.test" },
      { name: "pwuser", is_email_verified: false, email: null },
    ])
    // The NextAuth tables are untouched.
    const [old] = await sql`SELECT count(*)::int AS n FROM "bingoscape-next_account"`
    expect(old!.n).toBe(2)
  })

  it("is idempotent: the migration and the copy script add nothing on a second run", async () => {
    await seed()
    await mig.apply(MIGRATION)
    const first = await authAccounts()

    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    await sql.unsafe(script("auth-copy.sql"))

    expect(await authAccounts()).toEqual(first)
  })

  it("picks up sign-ups made after the migration when the copy script re-runs", async () => {
    await mig.apply(MIGRATION)
    const late = await user("late", { password: "$2b$12$late" })

    await sql.unsafe(script("auth-copy.sql"))

    expect(await authAccounts()).toEqual([
      expect.objectContaining({ user_id: late, provider_id: "credential" }),
    ])
  })

  it("embeds scripts/auth-copy.sql unchanged", () => {
    const copy = script("auth-copy.sql")
    const body = copy.slice(copy.indexOf("-- OAuth accounts."))
    const migration = fs.readFileSync(
      path.resolve(__dirname, `../../../drizzle/${MIGRATION}.sql`),
      "utf8"
    )
    expect(migration).toContain(body)
  })

  it("keeps the previous app working: it inserts users and accounts the old way", async () => {
    await mig.apply(MIGRATION)

    const id = await user("old-app", { email: "old@example.test" })
    await discordAccount(id, "d-old")

    const [row] = await sql<{ created_at: Date; is_email_verified: boolean }[]>`
      SELECT created_at, is_email_verified FROM "bingoscape-next_user" WHERE id = ${id}`
    expect(row!.is_email_verified).toBe(false)
    expect(row!.created_at).toBeInstanceOf(Date)
  })
})

describe("scripts/auth-copy-back.sql", () => {
  it("restores accounts and passwords that exist only in the Better Auth tables", async () => {
    await mig.apply(MIGRATION)
    // Created by the Better Auth app after the cutover.
    const oauth = await user("ba-oauth", { email: "ba@example.test" })
    const pw = await user("ba-pw")
    await sql`
      INSERT INTO "bingoscape-next_auth_account" (user_id, provider_id, account_id, access_token, access_token_expires_at)
      VALUES (${oauth}, 'discord', 'd-new', 'at', to_timestamp(1800000000))`
    await sql`
      INSERT INTO "bingoscape-next_auth_account" (user_id, provider_id, account_id, password)
      VALUES (${pw}, 'credential', ${pw}, '$2b$12$new')`

    await sql.unsafe(script("auth-copy-back.sql"))
    await sql.unsafe(script("auth-copy-back.sql"))

    const accounts = await sql`
      SELECT user_id, type, provider, provider_account_id, expires_at FROM "bingoscape-next_account"`
    expect(accounts).toEqual([
      {
        user_id: oauth,
        type: "oauth",
        provider: "discord",
        provider_account_id: "d-new",
        expires_at: 1800000000,
      },
    ])
    const [row] = await sql<{ password: string | null }[]>`
      SELECT password FROM "bingoscape-next_user" WHERE id = ${pw}`
    expect(row!.password).toBe("$2b$12$new")
  })

  it("never overwrites an existing password", async () => {
    await mig.apply(MIGRATION)
    const id = await user("keeper", { password: "$2b$12$old" })
    await sql.unsafe(script("auth-copy.sql"))
    await sql`
      UPDATE "bingoscape-next_auth_account" SET password = '$2b$12$other' WHERE user_id = ${id}`

    await sql.unsafe(script("auth-copy-back.sql"))

    const [row] = await sql<{ password: string | null }[]>`
      SELECT password FROM "bingoscape-next_user" WHERE id = ${id}`
    expect(row!.password).toBe("$2b$12$old")
  })
})
