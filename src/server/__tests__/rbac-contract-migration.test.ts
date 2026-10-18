/**
 * @jest-environment node
 *
 * Migration 0045 (RBAC 8/8, contract phase) applied to a real Postgres database
 * that is first brought to the state of migration 0040 and seeded the way the
 * previous app versions leave it. Each test gets its own throwaway database.
 */
import postgres from "postgres"

import { hashApiKey } from "@/lib/api-key"
import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
  violations,
} from "@/server/authz/verification"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0045_rbac_contract"
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

async function user(name: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email) VALUES (${name}, ${`${name}@example.test`})
    RETURNING id`
  return row!.id
}

async function event(name: string, creatorId: string | null) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
    VALUES (${name}, now(), now() + interval '1 day', ${creatorId})
    RETURNING id`
  return row!.id
}

async function participant(eventId: string, userId: string, role: string) {
  await sql`
    INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role)
    VALUES (${eventId}, ${userId}, ${role}::event_role)`
}

async function team(eventId: string, name: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_teams" (event_id, name) VALUES (${eventId}, ${name}) RETURNING id`
  return row!.id
}

/** What a pre-0038 app version does: no event_id. */
async function legacyTeamMember(
  teamId: string,
  userId: string,
  isLeader = false,
  createdAt = new Date()
) {
  await sql`
    INSERT INTO "bingoscape-next_team_members" (team_id, user_id, is_leader, created_at, updated_at)
    VALUES (${teamId}, ${userId}, ${isLeader}, ${createdAt}, ${createdAt})`
}

const roleOf = async (eventId: string, userId: string) =>
  (
    await sql<{ role: string }[]>`
      SELECT role FROM "bingoscape-next_event_participants"
      WHERE event_id = ${eventId} AND user_id = ${userId}`
  )[0]?.role

const ledgerOf = (eventId: string, userId: string) =>
  sql<{ action: string; old_role: string | null; new_role: string | null; source: string }[]>`
    SELECT action, old_role, new_role, source FROM "bingoscape-next_role_change_log"
    WHERE scope_type = 'event' AND scope_id = ${eventId} AND subject_user_id = ${userId}
    ORDER BY seq`

const columnExists = async (table: string, column: string) =>
  (
    await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}`
  ).length > 0

const isNullable = async (table: string, column: string) =>
  (
    await sql<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}`
  )[0]?.is_nullable === "YES"

const verifyAll = () =>
  runRbacVerification(
    async (q) => [...(await sql.unsafe(q))] as Record<string, unknown>[],
    RBAC_VERIFICATION_CHECKS
  )

describe("migration 0045: creators", () => {
  it("adds the missing admin row of a creator and promotes a creator with a lower role", async () => {
    const noRow = await user("noRow")
    const lowRole = await user("lowRole")
    const fine = await user("fine")
    const eventNoRow = await event("no row", noRow)
    const eventLow = await event("low", lowRole)
    const eventFine = await event("fine", fine)
    await participant(eventLow, lowRole, "management")
    await participant(eventFine, fine, "admin")
    // Another member is left alone.
    const other = await user("other")
    await participant(eventLow, other, "management")

    await mig.apply(MIGRATION)

    expect(await roleOf(eventNoRow, noRow)).toBe("admin")
    expect(await roleOf(eventLow, lowRole)).toBe("admin")
    expect(await roleOf(eventFine, fine)).toBe("admin")
    expect(await roleOf(eventLow, other)).toBe("management")
    // The ledger says what happened, once, from the migration (not the trigger).
    expect(await ledgerOf(eventNoRow, noRow)).toEqual([
      expect.objectContaining({ action: "backfill", new_role: "admin", source: "migration" }),
    ])
    const low = await ledgerOf(eventLow, lowRole)
    expect(low.at(-1)).toMatchObject({
      action: "change",
      old_role: "management",
      new_role: "admin",
      source: "migration",
    })
    // Later writes in the same session are logged by the trigger again.
    const late = await user("late")
    await participant(eventFine, late, "participant")
    expect((await ledgerOf(eventFine, late)).map((l) => l.source)).toEqual(["trigger"])
  })

  it("leaves Events without a creator alone", async () => {
    const eventC = await event("orphan", null)
    const member = await user("member")
    await participant(eventC, member, "participant")

    await mig.apply(MIGRATION)

    expect(await roleOf(eventC, member)).toBe("participant")
  })
})

describe("migration 0045: team_members.event_id NOT NULL", () => {
  it("backfills event_id, quarantines a duplicate Team of one Event, then enforces NOT NULL", async () => {
    const creator = await user("creator")
    const player = await user("player")
    const single = await user("single")
    const eventId = await event("E", creator)
    const other = await event("Other", creator)
    await participant(eventId, creator, "admin")
    await participant(eventId, player, "participant")
    await participant(eventId, single, "participant")
    await participant(other, player, "participant")
    const t1 = await team(eventId, "T1")
    const t2 = await team(eventId, "T2")
    const tOther = await team(other, "Other team")
    // The previous app put one player on two Teams of the same Event (NULL
    // event_id slips through the unique index), plus ordinary rows.
    await legacyTeamMember(t1, player, false, new Date("2026-01-01T10:00:00Z"))
    await legacyTeamMember(t2, player, false, new Date("2026-01-01T11:00:00Z"))
    await legacyTeamMember(t2, single)
    await legacyTeamMember(tOther, player)

    await mig.apply(MIGRATION)

    const rows = await sql<{ team_id: string; event_id: string; user_id: string }[]>`
      SELECT team_id, event_id, user_id FROM "bingoscape-next_team_members" ORDER BY team_id, user_id`
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.event_id !== null)).toBe(true)
    // The older Team of the duplicate is kept.
    expect(rows.filter((r) => r.user_id === player && r.event_id === eventId)).toEqual([
      expect.objectContaining({ team_id: t1 }),
    ])
    const quarantined = await sql`
      SELECT team_id, kept_team_id, reason FROM "bingoscape-next_team_members_quarantine"`
    expect(quarantined).toEqual([
      expect.objectContaining({ team_id: t2, kept_team_id: t1, reason: "multiple_teams_in_event" }),
    ])
    expect(await isNullable("bingoscape-next_team_members", "event_id")).toBe(false)
  })

  it("rejects a row without event_id afterwards and keeps accepting one with it", async () => {
    const creator = await user("creator")
    const player = await user("player")
    const eventId = await event("E", creator)
    const t = await team(eventId, "T")

    await mig.apply(MIGRATION)

    await expect(legacyTeamMember(t, player)).rejects.toThrow(/event_id/)
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, event_id, user_id)
          VALUES (${t}, ${eventId}, ${player})`
    ).resolves.toBeDefined()
    // The composite foreign key still ties event_id to the Team's Event.
    const wrong = await event("Wrong", creator)
    const other = await user("other")
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, event_id, user_id)
          VALUES (${t}, ${wrong}, ${other})`
    ).rejects.toThrow(/team_members_team_event_fk/)
  })

  it("accepted NULL event_id before the migration (the previous shape)", async () => {
    const creator = await user("creator")
    const player = await user("player")
    const eventId = await event("E", creator)
    const t = await team(eventId, "T")
    await expect(legacyTeamMember(t, player)).resolves.toBeUndefined()
  })
})

describe("migration 0045: api_keys", () => {
  const insertLegacy = (userId: string, key: string, hash: string | null) =>
    sql`INSERT INTO "bingoscape-next_api_keys" (user_id, name, key, key_hash)
        VALUES (${userId}, 'k', ${key}, ${hash})`

  it("hashes keys that have no hash yet, then drops the plaintext column", async () => {
    const owner = await user("owner")
    await insertLegacy(owner, "bsn_unhashed-key-created-after-0040", null)
    await insertLegacy(owner, "bsn_hashed", hashApiKey("bsn_hashed"))
    await sql`INSERT INTO "bingoscape-next_api_keys" (user_id, name, key_hash, key_prefix)
              VALUES (${owner}, 'new', ${hashApiKey("bsn_new")}, 'bsn_new')`

    await mig.apply(MIGRATION)

    expect(await columnExists("bingoscape-next_api_keys", "key")).toBe(false)
    const rows = await sql<{ key_hash: string; key_prefix: string | null }[]>`
      SELECT key_hash, key_prefix FROM "bingoscape-next_api_keys" ORDER BY key_hash`
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.key_hash)).toEqual(
      ["bsn_unhashed-key-created-after-0040", "bsn_hashed", "bsn_new"]
        .map(hashApiKey)
        .sort()
    )
    const backfilled = rows.find(
      (r) => r.key_hash === hashApiKey("bsn_unhashed-key-created-after-0040")
    )
    expect(backfilled?.key_prefix).toBe("bsn_unha")
  })

  it("keeps new-style inserts working and the hash unique", async () => {
    await mig.apply(MIGRATION)
    const owner = await user("owner")
    const insert = () =>
      sql`INSERT INTO "bingoscape-next_api_keys" (user_id, name, key_hash)
          VALUES (${owner}, 'k', ${"d".repeat(64)})`
    await insert()
    await expect(insert()).rejects.toThrow(/api_keys_key_hash_unique/)
  })

  it("rejects an insert that still names the legacy column", async () => {
    await mig.apply(MIGRATION)
    const owner = await user("owner")
    await expect(insertLegacy(owner, "bsn_x", null)).rejects.toThrow(/"key"/)
  })
})

describe("migration 0045: clan_invites.created_by and the user_role enum", () => {
  const typeExists = async () =>
    (await sql`SELECT 1 FROM pg_type WHERE typname = 'user_role'`).length > 0

  async function invite(creatorId: string) {
    const owner = await user("clanOwner")
    const [c] = await sql<{ id: string }[]>`
      INSERT INTO "bingoscape-next_clans" (name, owner_id) VALUES ('c', ${owner}) RETURNING id`
    await sql`
      INSERT INTO "bingoscape-next_clan_invites" (clan_id, invite_code, created_by)
      VALUES (${c!.id}, 'abc123', ${creatorId})`
  }

  it("could not delete the creator of an invite before the migration", async () => {
    const creator = await user("inviter")
    await invite(creator)
    await expect(
      sql`DELETE FROM "bingoscape-next_user" WHERE id = ${creator}`
    ).rejects.toThrow(/created_by/)
  })

  it("keeps the invite and clears created_by when its creator is deleted", async () => {
    const creator = await user("inviter")
    await invite(creator)

    await mig.apply(MIGRATION)
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${creator}`

    const rows = await sql`SELECT created_by FROM "bingoscape-next_clan_invites"`
    expect(rows).toEqual([expect.objectContaining({ created_by: null })])
  })

  it("drops the unused user_role enum", async () => {
    expect(await typeExists()).toBe(true)
    await mig.apply(MIGRATION)
    expect(await typeExists()).toBe(false)
  })
})

describe("migration 0045: discord_webhooks.created_by", () => {
  async function webhook(creatorId: string) {
    const owner = await user("eventOwner")
    const eventId = await event("E", owner)
    await sql`
      INSERT INTO "bingoscape-next_discord_webhooks" (event_id, name, webhook_url, created_by)
      VALUES (${eventId}, 'w', 'https://discord.com/api/webhooks/1/x', ${creatorId})`
  }

  it("removed the webhook with its creator before the migration", async () => {
    const creator = await user("hookCreator")
    await webhook(creator)
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${creator}`
    expect(await sql`SELECT 1 FROM "bingoscape-next_discord_webhooks"`).toEqual(
      []
    )
  })

  it("keeps the webhook and clears created_by when its creator is deleted", async () => {
    const creator = await user("hookCreator")
    await webhook(creator)

    await mig.apply(MIGRATION)
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${creator}`

    const rows = await sql`SELECT created_by FROM "bingoscape-next_discord_webhooks"`
    expect(rows).toEqual([expect.objectContaining({ created_by: null })])
  })
})

describe("migration 0045: whole", () => {
  async function seedPreviousAppState() {
    const creator = await user("creator")
    const p = await user("p")
    const eventId = await event("E", creator)
    await participant(eventId, p, "participant")
    const t = await team(eventId, "T")
    await legacyTeamMember(t, p)
    await sql`INSERT INTO "bingoscape-next_api_keys" (user_id, name, key)
              VALUES (${p}, 'k', 'bsn_seed')`
    return { creator, p, eventId }
  }

  it("is idempotent: a second run changes nothing and does not fail", async () => {
    const seeded = await seedPreviousAppState()
    await mig.apply(MIGRATION)
    const snapshot = async () => ({
      participants: await sql`SELECT event_id, user_id, role FROM "bingoscape-next_event_participants" ORDER BY user_id`,
      ledger: await sql`SELECT count(*)::int AS n FROM "bingoscape-next_role_change_log"`,
      members: await sql`SELECT team_id, event_id, user_id FROM "bingoscape-next_team_members"`,
      keys: await sql`SELECT key_hash, key_prefix FROM "bingoscape-next_api_keys"`,
    })
    const first = await snapshot()

    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()

    expect(await snapshot()).toEqual(first)
    expect(await roleOf(seeded.eventId, seeded.creator)).toBe("admin")
  })

  it("leaves a database on which every verification query returns no rows", async () => {
    await seedPreviousAppState()
    await mig.apply(MIGRATION)

    const results = await verifyAll()

    expect(violations(results).map((r) => `${r.id}${r.error ? `: ${r.error}` : ""}`)).toEqual([])
  })

  it("leaves the same columns, indexes and types as `drizzle-kit push` of the schema", async () => {
    await mig.apply(MIGRATION)
    const tables = [
      "bingoscape-next_api_keys",
      "bingoscape-next_clan_invites",
      "bingoscape-next_discord_webhooks",
      "bingoscape-next_team_members",
      "bingoscape-next_event_participants",
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
      userRoleType: (
        await client`SELECT 1 FROM pg_type WHERE typname = 'user_role'`
      ).length,
    })
    const pushed = postgres(process.env.DATABASE_URL!, { max: 1 })
    try {
      expect(await shape(sql)).toEqual(await shape(pushed))
    } finally {
      await pushed.end()
    }
  })

  it("applies to an empty database", async () => {
    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(violations(await verifyAll())).toEqual([])
  })
})
