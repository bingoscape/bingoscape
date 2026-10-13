/**
 * @jest-environment node
 *
 * Migration 0039: the safety-net trigger on event_participants / clan_members.
 * Runs on a throwaway database that has every real migration applied (the
 * shared Jest database is built with `drizzle-kit push` and has no trigger).
 * The membership helper is pointed at that database through the same seam the
 * transactional tests use, to prove it does not double-log next to the trigger.
 */
import { drizzle } from "drizzle-orm/postgres-js"
import type postgres from "postgres"

import {
  addMember,
  changeRole,
  removeMember,
  transferOwnership,
} from "@/server/authz/membership"
import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
} from "@/server/authz/verification"
import * as schema from "@/server/db/schema"
import {
  createMembershipWorld,
  ledgerOf,
  type MembershipWorld,
} from "@/server/__tests__/helpers/membership-fixture"
import {
  createMigrationDb,
  migrationStatements,
  type MigrationDb,
} from "@/server/__tests__/helpers/migration-db"

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const MIGRATION = "0039_rbac_role_change_trigger"

let mig: MigrationDb
let sql: postgres.Sql

beforeAll(async () => {
  mig = await createMigrationDb()
  sql = mig.sql
  await mig.applyThrough(MIGRATION)
  // events.timezone is in the Drizzle schema but in no migration file (a gap
  // that predates RBAC); the fixture inserts through the schema, so add it.
  await sql`ALTER TABLE "bingoscape-next_events" ADD COLUMN IF NOT EXISTS "timezone" varchar(100) NOT NULL DEFAULT 'UTC'`
})

afterAll(async () => {
  await mig.close()
})

async function user(name: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email)
    VALUES (${name}, ${`${name}-${Math.random().toString(36).slice(2)}@trigger.test`})
    RETURNING id`
  return row!.id
}

async function event(creatorId: string | null) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
    VALUES ('trigger', now(), now() + interval '1 day', ${creatorId})
    RETURNING id`
  return row!.id
}

async function clan(ownerId: string | null) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_clans" (name, owner_id) VALUES ('trigger', ${ownerId}) RETURNING id`
  return row!.id
}

async function ledger(scopeId: string) {
  return sql<
    {
      action: string
      old_role: string | null
      new_role: string | null
      source: string
      subject_user_id: string
      actor_user_id: string | null
    }[]
  >`SELECT action, old_role, new_role, source, subject_user_id, actor_user_id
    FROM "bingoscape-next_role_change_log" WHERE scope_id = ${scopeId} ORDER BY seq`
}

describe("writes that bypass the helper (previous app version)", () => {
  it("logs an event participant insert, role change and delete as source trigger", async () => {
    const creator = await user("creator")
    const p = await user("p")
    const e = await event(creator)

    await sql`INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role) VALUES (${e}, ${p}, 'participant')`
    await sql`UPDATE "bingoscape-next_event_participants" SET role = 'management' WHERE event_id = ${e} AND user_id = ${p}`
    await sql`UPDATE "bingoscape-next_event_participants" SET updated_at = now() WHERE event_id = ${e} AND user_id = ${p}`
    await sql`DELETE FROM "bingoscape-next_event_participants" WHERE event_id = ${e} AND user_id = ${p}`

    expect(await ledger(e)).toEqual([
      expect.objectContaining({
        action: "add",
        old_role: null,
        new_role: "participant",
        source: "trigger",
        subject_user_id: p,
        actor_user_id: null,
      }),
      expect.objectContaining({
        action: "change",
        old_role: "participant",
        new_role: "management",
        source: "trigger",
      }),
      expect.objectContaining({
        action: "remove",
        old_role: "management",
        new_role: null,
        source: "trigger",
      }),
    ])
  })

  it("logs clan member writes, but not changes of other columns", async () => {
    const owner = await user("owner")
    const m = await user("m")
    const c = await clan(owner)
    await sql`INSERT INTO "bingoscape-next_clan_members" (clan_id, user_id, role) VALUES (${c}, ${m}, 'member')`
    await sql`UPDATE "bingoscape-next_clan_members" SET is_main = true WHERE clan_id = ${c} AND user_id = ${m}`
    await sql`UPDATE "bingoscape-next_clan_members" SET role = 'admin' WHERE clan_id = ${c} AND user_id = ${m}`
    await sql`DELETE FROM "bingoscape-next_clan_members" WHERE clan_id = ${c} AND user_id = ${m}`

    expect(
      (await ledger(c)).map((r) => [r.action, r.old_role, r.new_role])
    ).toEqual([
      ["add", null, "member"],
      ["change", "member", "admin"],
      ["remove", "admin", null],
    ])
  })

  it("leaves the ledger consistent with the live state (no drift)", async () => {
    const creator = await user("creator")
    const p = await user("p")
    const q = await user("q")
    const e = await event(creator)
    await sql`INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role) VALUES (${e}, ${creator}, 'admin'), (${e}, ${p}, 'participant'), (${e}, ${q}, 'participant')`
    await sql`UPDATE "bingoscape-next_event_participants" SET role = 'management' WHERE event_id = ${e} AND user_id = ${p}`
    await sql`DELETE FROM "bingoscape-next_event_participants" WHERE event_id = ${e} AND user_id = ${q}`

    const [drift] = await runRbacVerification(
      async (query) =>
        [...(await sql.unsafe(query))] as Record<string, unknown>[],
      RBAC_VERIFICATION_CHECKS.filter((c) => c.id === "ledger_drift")
    )
    expect(drift!.rows.filter((r) => String(r.scope_id) === e)).toEqual([])
  })

  it("does not log cascades from deleting an Event or a user", async () => {
    const creator = await user("creator")
    const p = await user("p")
    const e = await event(creator)
    const c = await clan(creator)
    await sql`INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role) VALUES (${e}, ${creator}, 'admin'), (${e}, ${p}, 'participant')`
    await sql`INSERT INTO "bingoscape-next_clan_members" (clan_id, user_id, role) VALUES (${c}, ${creator}, 'admin'), (${c}, ${p}, 'member')`
    const before = (await ledger(e)).length
    const clanBefore = (await ledger(c)).length

    // Deleting the user cascades its memberships (the clan row stays).
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${p}`
    // Deleting the Event and the Clan cascades the rest.
    await sql`DELETE FROM "bingoscape-next_events" WHERE id = ${e}`
    await sql`DELETE FROM "bingoscape-next_clans" WHERE id = ${c}`

    expect((await ledger(e)).length).toBe(before)
    expect((await ledger(c)).length).toBe(clanBefore)
    expect((await ledger(e)).some((r) => r.action === "remove")).toBe(false)
  })
})

describe("writes that announce their source", () => {
  it("leaves them alone, only for the transaction that set the source", async () => {
    const creator = await user("creator")
    const p = await user("p")
    const q = await user("q")
    const e = await event(creator)

    await sql.begin(async (tx) => {
      const insert = (userId: string) =>
        tx.unsafe(
          `INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role) VALUES ('${e}', '${userId}', 'participant')`
        )
      await tx.unsafe(`select set_config('app.audit_source', 'app', true)`)
      await insert(p)
      await tx.unsafe(`select set_config('app.audit_source', '', true)`)
      // The helper resets the source when it is done: later writes of the same
      // transaction are caught again.
      await insert(q)
    })
    await sql`UPDATE "bingoscape-next_event_participants" SET role = 'management' WHERE event_id = ${e} AND user_id = ${p}`

    const rows = await ledger(e)
    expect(
      rows.map((r) => [r.subject_user_id === p ? "p" : "q", r.action, r.source])
    ).toEqual([
      ["q", "add", "trigger"],
      ["p", "change", "trigger"],
    ])
  })
})

describe("changeRole() and the trigger together", () => {
  let world: MembershipWorld
  let previous: unknown

  beforeAll(() => {
    previous = globalThis.__TEST_TX__
    globalThis.__TEST_TX__ = drizzle(sql, { schema })
  })

  afterAll(() => {
    globalThis.__TEST_TX__ = previous
  })

  beforeEach(async () => {
    world = await createMembershipWorld()
  })

  afterEach(async () => {
    await world.cleanup()
  })

  it("writes exactly one ledger row per operation and none by the trigger", async () => {
    const user = (id: string) => ({ kind: "user", userId: id }) as const
    await changeRole({
      scope: "event",
      parentId: world.eventId,
      userId: world.id.player,
      newRole: "management",
      actor: user(world.id.owner),
    })
    await addMember({
      scope: "event",
      parentId: world.eventId,
      userId: world.id.outsider,
      role: "participant",
      actor: { kind: "self", userId: world.id.outsider },
    })
    await removeMember({
      scope: "event",
      parentId: world.eventId,
      userId: world.id.player2,
      actor: user(world.id.owner),
    })
    await transferOwnership({
      scope: "event",
      parentId: world.eventId,
      newOwnerId: world.id.admin,
      actor: user(world.id.owner),
    })
    await changeRole({
      scope: "clan",
      parentId: world.clanId,
      userId: world.id.player,
      newRole: "guest",
      actor: user(world.id.owner),
    })
    await removeMember({
      scope: "clan",
      parentId: world.clanId,
      userId: world.id.manager,
      actor: user(world.id.owner),
    })

    const event = await ledgerOf(world.eventId)
    const clanRows = await ledgerOf(world.clanId)
    expect(event.some((r) => r.source === "trigger")).toBe(false)
    expect(clanRows.some((r) => r.source === "trigger")).toBe(false)
    // Seed: 6 event memberships + 4 clan memberships, then 4 + 2 operations.
    expect(event).toHaveLength(6 + 4)
    expect(clanRows).toHaveLength(4 + 2)
  })

  it("a refused operation writes no ledger row", async () => {
    const before = (await ledgerOf(world.eventId)).length
    await changeRole({
      scope: "event",
      parentId: world.eventId,
      userId: world.id.owner,
      newRole: "participant",
      actor: { kind: "user", userId: world.id.admin },
    })
    expect((await ledgerOf(world.eventId)).length).toBe(before)
  })
})

describe("the migration itself", () => {
  it("is idempotent: applying the file again changes nothing", async () => {
    await mig.apply(MIGRATION)
    await mig.apply(MIGRATION)
    const triggers = await sql<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgname LIKE '%_role_ledger' ORDER BY tgname`
    expect(triggers.map((t) => t.tgname)).toEqual([
      "clan_members_role_ledger",
      "event_participants_role_ledger",
    ])
  })

  it("accepts the trigger source and still rejects unknown sources", async () => {
    const u = await user("u")
    const insert = (source: string) =>
      sql`INSERT INTO "bingoscape-next_role_change_log" (scope_type, scope_id, subject_user_id, action, new_role, source)
          VALUES ('event', gen_random_uuid(), ${u}, 'add', 'admin', ${source})`
    await expect(insert("trigger")).resolves.toBeDefined()
    await expect(insert("bogus")).rejects.toThrow(
      /role_change_log_source_check/
    )
  })

  it("is a plain add-first change: nothing is dropped except the replaced check", () => {
    const text = migrationStatements(MIGRATION).join("\n")
    expect(text).not.toMatch(/DROP (TABLE|COLUMN|INDEX)/i)
    expect(text).not.toMatch(/ALTER TABLE[^;]*DROP COLUMN/i)
  })
})

describe("catching up the ledger", () => {
  it("baselines, repairs and closes entries the previous app version left behind", async () => {
    const own = await createMigrationDb()
    try {
      const db = own.sql
      const row = async (query: string) => [...(await db.unsafe(query))]
      await own.applyThrough("0037_battleship")
      const ids = await row(`
        WITH u AS (
          INSERT INTO "bingoscape-next_user" (name, email)
          SELECT n, n || '@catchup.test' FROM unnest(ARRAY['creator','p','q','r']) AS n
          RETURNING id, name
        )
        SELECT id, name FROM u`)
      const id = Object.fromEntries(
        ids.map((r) => [r.name as string, r.id as string])
      )
      const [event] = await row(`
        INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id)
        VALUES ('catchup', now(), now() + interval '1 day', '${id.creator}') RETURNING id`)
      const e = event!.id as string
      await db.unsafe(`INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role)
        VALUES ('${e}', '${id.creator}', 'admin'), ('${e}', '${id.p}', 'participant'), ('${e}', '${id.r}', 'participant')`)
      // 0038 baselines creator, p and r.
      await own.apply("0038_rbac_membership_integrity")

      // Previous app version, after 0038 and before 0039: no ledger rows.
      await db.unsafe(
        `INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role) VALUES ('${e}', '${id.q}', 'management')`
      )
      await db.unsafe(
        `UPDATE "bingoscape-next_event_participants" SET role = 'management' WHERE event_id = '${e}' AND user_id = '${id.p}'`
      )
      await db.unsafe(
        `DELETE FROM "bingoscape-next_event_participants" WHERE event_id = '${e}' AND user_id = '${id.r}'`
      )

      await own.apply(MIGRATION)
      await own.apply(MIGRATION) // idempotent

      const rows = await row(`
        SELECT subject_user_id AS u, action, old_role, new_role, source
        FROM "bingoscape-next_role_change_log" WHERE scope_id = '${e}' AND action <> 'baseline' OR (scope_id = '${e}' AND subject_user_id = '${id.q}')
        ORDER BY seq`)
      const byUser = (user: string) =>
        rows
          .filter((r) => r.u === id[user])
          .map((r) => [r.action, r.old_role, r.new_role, r.source])
      expect(byUser("q")).toEqual([
        ["baseline", null, "management", "migration"],
      ])
      expect(byUser("p")).toEqual([
        ["backfill", "participant", "management", "migration"],
      ])
      expect(byUser("r")).toEqual([
        ["remove", "participant", null, "migration"],
      ])

      const [drift] = await runRbacVerification(
        async (query) =>
          [...(await db.unsafe(query))] as Record<string, unknown>[],
        RBAC_VERIFICATION_CHECKS.filter((c) => c.id === "ledger_drift")
      )
      expect(drift!.rows).toEqual([])
    } finally {
      await own.close()
    }
  })
})
