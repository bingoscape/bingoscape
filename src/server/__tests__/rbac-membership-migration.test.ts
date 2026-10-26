/**
 * @jest-environment node
 *
 * Migration 0038 (RBAC 2/8) applied to a real Postgres database that is first
 * brought to the state of migration 0037 and seeded with dirty data, plus the
 * verification queries that reconcile it (src/server/authz/verification.ts).
 * Each test gets its own throwaway database next to the Jest one.
 */
import postgres from "postgres"

import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
  violations,
  type VerificationResult,
} from "@/server/authz/verification"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0038_rbac_membership_integrity"
const PREVIOUS = "0037_battleship"

/** Checks that only touch tables and columns that exist before 0038. */
const PRE_MIGRATION_CHECKS = RBAC_VERIFICATION_CHECKS.filter(
  (c) =>
    ![
      "ledger_drift",
      "team_members_event_id_mismatch",
      "team_members_missing_event_id",
    ].includes(c.id)
)

const T = (ts: string) => new Date(`2026-01-01T${ts}Z`)

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

const verify = async (checks = RBAC_VERIFICATION_CHECKS) =>
  runRbacVerification(
    async (q) => [...(await sql.unsafe(q))] as Record<string, unknown>[],
    checks
  )

const failing = (results: VerificationResult[]) =>
  violations(results).map((r) => r.id)

async function user(
  name: string,
  extra: { email?: string | null; username?: string | null } = {}
) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_user" (name, email, username)
    VALUES (${name}, ${extra.email === undefined ? `${name}@example.test` : extra.email}, ${extra.username ?? null})
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

async function participant(
  eventId: string,
  userId: string,
  role: string,
  createdAt: Date
) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role, created_at, updated_at)
    VALUES (${eventId}, ${userId}, ${role}::event_role, ${createdAt}, ${createdAt})
    RETURNING id`
  return row!.id
}

async function team(eventId: string, name: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_teams" (event_id, name) VALUES (${eventId}, ${name}) RETURNING id`
  return row!.id
}

async function teamMember(
  teamId: string,
  userId: string,
  isLeader: boolean,
  createdAt: Date
) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_team_members" (team_id, user_id, is_leader, created_at, updated_at)
    VALUES (${teamId}, ${userId}, ${isLeader}, ${createdAt}, ${createdAt})
    RETURNING id`
  return row!.id
}

const buyIn = (participantId: string, amount: number) =>
  sql`INSERT INTO "bingoscape-next_event_buy_ins" (event_participant_id, amount) VALUES (${participantId}, ${amount})`
const donation = (participantId: string, amount: number) =>
  sql`INSERT INTO "bingoscape-next_event_donations" (event_participant_id, amount) VALUES (${participantId}, ${amount})`

async function clan(name: string, ownerId: string | null) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_clans" (name, owner_id) VALUES (${name}, ${ownerId}) RETURNING id`
  return row!.id
}
const clanMember = (clanId: string, userId: string, role: string) =>
  sql`INSERT INTO "bingoscape-next_clan_members" (clan_id, user_id, role) VALUES (${clanId}, ${userId}, ${role}::clan_role)`

/** Dirty production-like data. Returns the ids the assertions need. */
async function seedDirty() {
  const creatorA = await user("creatorA")
  const creatorB = await user("creatorB")
  const p = await user("p")
  const q = await user("q")
  const r = await user("r")
  const s = await user("s")
  const clanOwner = await user("clanOwner")

  const eventA = await event("A", creatorA) // creator has no participant row
  const eventB = await event("B", creatorB) // creator is only a participant
  const eventC = await event("C", null) // no creator, no admin

  // p: participant (oldest), management, management (newest) -> keeps the older management row.
  const pOld = await participant(eventA, p, "participant", T("10:00:00"))
  const pMid = await participant(eventA, p, "management", T("11:00:00"))
  const pNew = await participant(eventA, p, "management", T("12:00:00"))
  await buyIn(pOld, 100)
  await buyIn(pNew, 200)
  await donation(pNew, 50)
  await donation(pMid, 5)
  // q: two plain participant rows -> keeps the older one.
  const qOld = await participant(eventA, q, "participant", T("09:00:00"))
  const qNew = await participant(eventA, q, "participant", T("09:30:00"))
  await buyIn(qNew, 7)
  const rP = await participant(eventA, r, "participant", T("08:00:00"))
  const sP = await participant(eventA, s, "participant", T("08:00:00"))

  await participant(eventB, creatorB, "participant", T("08:00:00"))
  const adminB = await user("adminB")
  await participant(eventB, adminB, "admin", T("08:00:00"))
  await participant(eventB, r, "participant", T("08:00:00"))

  const teamA1 = await team(eventA, "A1")
  const teamA2 = await team(eventA, "A2")
  const teamB1 = await team(eventB, "B1")
  // p: twice in A1 -> the leader row (newer) is kept.
  const pTmOld = await teamMember(teamA1, p, false, T("10:00:00"))
  const pTmLeader = await teamMember(teamA1, p, true, T("11:00:00"))
  // r: on A1 (older) and A2 (newer) -> keeps A1; unrelated membership of B1 stays.
  const rTmA1 = await teamMember(teamA1, r, false, T("10:00:00"))
  const rTmA2 = await teamMember(teamA2, r, false, T("11:00:00"))
  const rTmB1 = await teamMember(teamB1, r, false, T("10:00:00"))
  const sTm = await teamMember(teamA1, s, false, T("10:00:00"))
  // Team member who is not a participant of the Event (reported, not fixed).
  const stranger = await user("stranger")
  await teamMember(teamA2, stranger, false, T("10:00:00"))

  const clanX = await clan("X", clanOwner)
  await clanMember(clanX, clanOwner, "admin")
  await clanMember(clanX, p, "member")

  return {
    users: { creatorA, creatorB, p, q, r, s, stranger, adminB },
    events: { eventA, eventB, eventC },
    participants: { pOld, pMid, pNew, qOld, qNew, rP, sP },
    teams: { teamA1, teamA2, teamB1 },
    members: { pTmOld, pTmLeader, rTmA1, rTmA2, rTmB1, sTm },
    clanX,
  }
}

const count = async (table: string) => {
  const [row] = await sql.unsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "${table}"`
  )
  return row!.n
}

describe("migration 0038: dirty data", () => {
  it("is reported by the verification queries before the migration", async () => {
    await seedDirty()
    const before = await verify(PRE_MIGRATION_CHECKS)
    expect(failing(before)).toEqual(
      expect.arrayContaining([
        "duplicate_participants",
        "duplicate_team_members_in_team",
        "duplicate_team_members_in_event",
        "events_without_admin",
        "team_members_not_participants",
        "creator_without_participant_row",
        "creator_role_conflicts",
        "missing_membership_indexes",
      ])
    )
  })

  it("dedupes participants (highest role, then oldest) and re-points buy-ins and donations", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)

    const rows = await sql<{ id: string; role: string }[]>`
      SELECT id, role FROM "bingoscape-next_event_participants"
      WHERE event_id = ${d.events.eventA} AND user_id IN (${d.users.p}, ${d.users.q})`
    expect(rows.map((x) => x.id).sort()).toEqual(
      [d.participants.pMid, d.participants.qOld].sort()
    )
    expect(rows.find((x) => x.id === d.participants.pMid)?.role).toBe(
      "management"
    )

    // Everything of the removed rows now hangs off the keeper.
    const buyIns = await sql<
      { event_participant_id: string; amount: string }[]
    >`
      SELECT event_participant_id, amount FROM "bingoscape-next_event_buy_ins" ORDER BY amount`
    expect(
      buyIns.map((b) => [b.event_participant_id, Number(b.amount)])
    ).toEqual([
      [d.participants.qOld, 7],
      [d.participants.pMid, 100],
      [d.participants.pMid, 200],
    ])
    const donations = await sql<
      { event_participant_id: string; amount: string }[]
    >`
      SELECT event_participant_id, amount FROM "bingoscape-next_event_donations" ORDER BY amount`
    expect(
      donations.map((x) => [x.event_participant_id, Number(x.amount)])
    ).toEqual([
      [d.participants.pMid, 5],
      [d.participants.pMid, 50],
    ])

    const quarantined = await sql<
      { original_id: string; kept_participant_id: string; role: string }[]
    >`
      SELECT original_id, kept_participant_id, role
      FROM "bingoscape-next_event_participants_quarantine" ORDER BY original_id`
    expect(quarantined.map((x) => x.original_id).sort()).toEqual(
      [d.participants.pOld, d.participants.pNew, d.participants.qNew].sort()
    )
    expect(
      quarantined.find((x) => x.original_id === d.participants.pNew)
    ).toMatchObject({
      kept_participant_id: d.participants.pMid,
      role: "management",
    })
  })

  it("rejects new duplicate participants once migrated, and ON CONFLICT DO NOTHING tolerates them", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)
    await expect(
      participant(d.events.eventA, d.users.s, "participant", T("13:00:00"))
    ).rejects.toThrow(/event_participants_event_user_unique/)
    await sql`INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role)
      VALUES (${d.events.eventA}, ${d.users.s}, 'participant') ON CONFLICT DO NOTHING`
  })

  it("backfills team_members.event_id and quarantines duplicate team memberships", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)

    const members = await sql<
      { id: string; team_id: string; event_id: string; is_leader: boolean }[]
    >`
      SELECT id, team_id, event_id, is_leader FROM "bingoscape-next_team_members"
      WHERE user_id IN (${d.users.p}, ${d.users.r}, ${d.users.s})`
    expect(members.map((m) => m.id).sort()).toEqual(
      [
        d.members.pTmLeader,
        d.members.rTmA1,
        d.members.rTmB1,
        d.members.sTm,
      ].sort()
    )
    // Backfilled from the Team's Event.
    expect(members.find((m) => m.id === d.members.rTmB1)?.event_id).toBe(
      d.events.eventB
    )
    expect(members.find((m) => m.id === d.members.sTm)?.event_id).toBe(
      d.events.eventA
    )
    expect(members.find((m) => m.id === d.members.pTmLeader)?.is_leader).toBe(
      true
    )
    const [nulls] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "bingoscape-next_team_members" WHERE event_id IS NULL`
    expect(nulls?.n).toBe(0)

    const quarantined = await sql<
      {
        original_id: string
        reason: string
        kept_team_member_id: string
        kept_team_id: string
      }[]
    >`
      SELECT original_id, reason, kept_team_member_id, kept_team_id
      FROM "bingoscape-next_team_members_quarantine"`
    expect(quarantined).toHaveLength(2)
    expect(
      quarantined.find((x) => x.original_id === d.members.pTmOld)
    ).toMatchObject({
      reason: "duplicate_in_team",
      kept_team_member_id: d.members.pTmLeader,
    })
    expect(
      quarantined.find((x) => x.original_id === d.members.rTmA2)
    ).toMatchObject({
      reason: "multiple_teams_in_event",
      kept_team_member_id: d.members.rTmA1,
      kept_team_id: d.teams.teamA1,
    })

    // A Player on two Teams of one Event is now impossible; a NULL event_id
    // (previous app version) and a mismatching event_id are tolerated / rejected.
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, event_id, user_id)
        VALUES (${d.teams.teamA2}, ${d.events.eventA}, ${d.users.r})`
    ).rejects.toThrow(/team_members_event_user_unique/)
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, event_id, user_id)
        VALUES (${d.teams.teamA2}, ${d.events.eventB}, ${d.users.q})`
    ).rejects.toThrow(/team_members_team_event_fk/)
    await sql`INSERT INTO "bingoscape-next_team_members" (team_id, user_id)
      VALUES (${d.teams.teamA2}, ${d.users.q})`
    await expect(
      sql`INSERT INTO "bingoscape-next_team_members" (team_id, user_id)
        VALUES (${d.teams.teamA2}, ${d.users.q})`
    ).rejects.toThrow(/team_members_team_user_unique/)
  })

  it("adds an admin row for creators without one and logs it as backfill", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)

    const [row] = await sql<{ role: string }[]>`
      SELECT role FROM "bingoscape-next_event_participants"
      WHERE event_id = ${d.events.eventA} AND user_id = ${d.users.creatorA}`
    expect(row?.role).toBe("admin")

    const log = await sql<
      {
        action: string
        old_role: string | null
        new_role: string
        source: string
        actor_user_id: string | null
      }[]
    >`
      SELECT action, old_role, new_role, source, actor_user_id FROM "bingoscape-next_role_change_log"
      WHERE scope_type = 'event' AND scope_id = ${d.events.eventA} AND subject_user_id = ${d.users.creatorA}`
    expect(log).toEqual([
      {
        action: "backfill",
        old_role: null,
        new_role: "admin",
        source: "migration",
        actor_user_id: null,
      },
    ])

    // A creator with an explicit non-admin row keeps it (reported, not changed).
    const [conflict] = await sql<{ role: string }[]>`
      SELECT role FROM "bingoscape-next_event_participants"
      WHERE event_id = ${d.events.eventB} AND user_id = ${d.users.creatorB}`
    expect(conflict?.role).toBe("participant")
  })

  it("seeds one baseline ledger row per remaining membership, so the ledger replays to the live state", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)

    const participants = await count("bingoscape-next_event_participants")
    const clanMembers = await count("bingoscape-next_clan_members")
    const byAction = await sql<{ action: string; n: number }[]>`
      SELECT action, count(*)::int AS n FROM "bingoscape-next_role_change_log" GROUP BY action`
    const n = (a: string) => byAction.find((x) => x.action === a)?.n ?? 0
    expect(n("backfill")).toBe(1)
    expect(n("baseline")).toBe(participants - 1 + clanMembers)
    expect(await count("bingoscape-next_role_change_log")).toBe(
      participants + clanMembers
    )

    const [clanRow] = await sql<{ new_role: string; scope_type: string }[]>`
      SELECT scope_type, new_role FROM "bingoscape-next_role_change_log"
      WHERE scope_id = ${d.clanX} AND subject_user_id = ${d.users.p}`
    expect(clanRow).toMatchObject({ scope_type: "clan", new_role: "member" })

    const results = await verify()
    expect(failing(results)).not.toContain("ledger_drift")

    // Replay catches a role changed behind the ledger's back.
    await sql`UPDATE "bingoscape-next_event_participants" SET role = 'admin'
      WHERE event_id = ${d.events.eventA} AND user_id = ${d.users.s}`
    const drifted = await verify()
    expect(drifted.find((x) => x.id === "ledger_drift")?.rows).toEqual([
      expect.objectContaining({
        subject_user_id: d.users.s,
        live_role: "admin",
        ledger_role: "participant",
      }),
    ])
  })

  it("leaves only the documented exceptions, which the verification queries still report", async () => {
    const d = await seedDirty()
    await mig.apply(MIGRATION)
    const after = await verify()
    expect(
      violations(after, "error")
        .map((r) => r.id)
        .sort()
    ).toEqual([
      "creator_role_conflicts",
      "events_without_admin",
      "team_members_not_participants",
    ])
    expect(after.find((r) => r.id === "creator_role_conflicts")?.rows).toEqual([
      expect.objectContaining({
        creator_id: d.users.creatorB,
        explicit_role: "participant",
      }),
    ])
    expect(
      after.find((r) => r.id === "team_members_not_participants")?.rows
    ).toEqual([expect.objectContaining({ user_id: d.users.stranger })])
    // Events A and B have an admin; only event C has none.
    expect(after.find((r) => r.id === "events_without_admin")?.rows).toEqual([
      expect.objectContaining({ event_id: d.events.eventC }),
    ])
  })

  it("is idempotent: running the migration file again changes nothing", async () => {
    await seedDirty()
    await mig.apply(MIGRATION)
    const tables = [
      "bingoscape-next_event_participants",
      "bingoscape-next_event_participants_quarantine",
      "bingoscape-next_team_members",
      "bingoscape-next_team_members_quarantine",
      "bingoscape-next_role_change_log",
      "bingoscape-next_event_buy_ins",
      "bingoscape-next_event_donations",
    ]
    const snapshot = async () => Promise.all(tables.map(count))
    const before = await snapshot()
    await mig.apply(MIGRATION)
    await mig.apply(MIGRATION)
    expect(await snapshot()).toEqual(before)
  })

  it("passes every check on clean data, before and after", async () => {
    const creator = await user("creator")
    const member = await user("member")
    const e = await event("clean", creator)
    await participant(e, creator, "admin", T("10:00:00"))
    await participant(e, member, "participant", T("10:00:00"))
    const t = await team(e, "T")
    await teamMember(t, member, false, T("10:00:00"))
    const c = await clan("C", creator)
    await clanMember(c, creator, "admin")

    const pre = await verify(PRE_MIGRATION_CHECKS)
    // Only the not yet created unique indexes are reported.
    expect(failing(pre)).toEqual([
      "missing_membership_indexes",
      "missing_user_unique_indexes",
    ])

    await mig.apply(MIGRATION)
    expect(failing(await verify())).toEqual([])
  })

  it("leaves the same indexes and columns as `drizzle-kit push` of the schema", async () => {
    await mig.apply(MIGRATION)
    // The pushed schema is the end state: it also has the columns of 0040
    // (RBAC 7/8), the contract of 0045 (RBAC 8/8, event_id NOT NULL), the
    // user columns of 0046 (Better Auth 2/4) and the drops of 0047 (4b).
    await mig.apply("0040_credential_session_hygiene")
    await mig.apply("0045_rbac_contract")
    await mig.apply("0046_better_auth_expand")
    await mig.apply("0047_better_auth_contract")
    const tables = [
      "bingoscape-next_event_participants",
      "bingoscape-next_team_members",
      "bingoscape-next_teams",
      "bingoscape-next_user",
      "bingoscape-next_event_participants_quarantine",
      "bingoscape-next_team_members_quarantine",
      "bingoscape-next_role_change_log",
      "bingoscape-next_event_audit_log",
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

  it("applies cleanly to an empty database", async () => {
    await mig.apply(MIGRATION)
    expect(failing(await verify())).toEqual([])
  })
})

describe("migration 0038: constraints on the new tables", () => {
  const ledger = (over: Record<string, string | null> = {}) => {
    const row = {
      scope_type: "event",
      scope_id: "00000000-0000-0000-0000-000000000001",
      action: "change",
      old_role: "participant",
      new_role: "admin",
      source: "app",
      ...over,
    }
    return sql`INSERT INTO "bingoscape-next_role_change_log" (scope_type, scope_id, action, old_role, new_role, source)
      VALUES (${row.scope_type}, ${row.scope_id}, ${row.action}, ${row.old_role}, ${row.new_role}, ${row.source})`
  }

  it("enforces the enumerated columns of role_change_log", async () => {
    await mig.apply(MIGRATION)
    await ledger()
    await ledger({ scope_type: "clan", old_role: "guest", new_role: "member" })
    await ledger({ old_role: null, action: "add" })
    await expect(
      ledger({ scope_type: "team", old_role: null, new_role: null })
    ).rejects.toThrow(/scope_type_check/)
    await expect(ledger({ action: "promote" })).rejects.toThrow(/action_check/)
    await expect(ledger({ source: "cron" })).rejects.toThrow(/source_check/)
    await expect(ledger({ new_role: "owner" })).rejects.toThrow(
      /new_role_check/
    )
    // Roles are validated per scope: 'guest' is a Clan role only.
    await expect(ledger({ old_role: "guest" })).rejects.toThrow(
      /old_role_check/
    )
    await expect(
      ledger({ scope_type: "clan", new_role: "participant" })
    ).rejects.toThrow(/new_role_check/)
  })

  it("orders ledger rows with seq and accepts audit rows for every outcome", async () => {
    await mig.apply(MIGRATION)
    await ledger()
    await ledger()
    const seqs = await sql<
      { seq: string }[]
    >`SELECT seq FROM "bingoscape-next_role_change_log" ORDER BY seq`
    expect(Number(seqs[1]!.seq)).toBeGreaterThan(Number(seqs[0]!.seq))

    for (const outcome of ["success", "denied", "failed"]) {
      await sql`INSERT INTO "bingoscape-next_event_audit_log" (action, outcome) VALUES ('x', ${outcome})`
    }
    await expect(
      sql`INSERT INTO "bingoscape-next_event_audit_log" (action, outcome) VALUES ('x', 'maybe')`
    ).rejects.toThrow(/outcome_check/)
  })

  it("survives deletion of the user and Event it refers to (no foreign keys)", async () => {
    await mig.apply(MIGRATION)
    const u = await user("gone")
    const e = await event("gone", u)
    await sql`INSERT INTO "bingoscape-next_role_change_log" (scope_type, scope_id, subject_user_id, action, new_role, source)
      VALUES ('event', ${e}, ${u}, 'add', 'participant', 'app')`
    await sql`INSERT INTO "bingoscape-next_event_audit_log" (event_id, actor_user_id, action, outcome)
      VALUES (${e}, ${u}, 'event.delete', 'success')`
    await sql`DELETE FROM "bingoscape-next_events" WHERE id = ${e}`
    await sql`DELETE FROM "bingoscape-next_user" WHERE id = ${u}`
    expect(await count("bingoscape-next_role_change_log")).toBe(1)
    expect(await count("bingoscape-next_event_audit_log")).toBe(1)
    // The deleted membership is not reported as drift.
    expect(failing(await verify())).not.toContain("ledger_drift")
  })
})

describe("migration 0038: users.username and users.email", () => {
  const indexNames = async () =>
    (
      await sql<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes WHERE indexname IN ('users_username_unique', 'users_email_unique')`
    ).map((x) => x.indexname)

  it("creates both unique indexes when there are no duplicates", async () => {
    await user("a", { username: "alice" })
    await user("b", { username: "bob", email: null })
    await user("c", { username: null, email: null }) // NULLs never conflict
    await user("d", { username: null, email: null })
    await mig.apply(MIGRATION)
    expect((await indexNames()).sort()).toEqual([
      "users_email_unique",
      "users_username_unique",
    ])
    await expect(user("e", { username: "alice" })).rejects.toThrow(
      /users_username_unique/
    )
  })

  it("does not fail the deploy on duplicates: skips the index and reports them", async () => {
    await user("a", { username: "dup", email: "same@example.test" })
    await user("b", { username: "dup", email: "same@example.test" })
    await user("c", { username: "ok", email: "Case@example.test" })
    await user("d", { username: "ok2", email: "case@example.test" })

    await expect(mig.apply(MIGRATION)).resolves.toBeUndefined()
    expect(await indexNames()).toEqual([])

    const results = await verify()
    expect(results.find((r) => r.id === "duplicate_usernames")?.rows).toEqual([
      { username: "dup", row_count: 2 },
    ])
    expect(results.find((r) => r.id === "duplicate_emails")?.rows).toEqual([
      { email: "same@example.test", row_count: 2 },
    ])
    expect(
      results.find((r) => r.id === "duplicate_emails_ignoring_case")?.rows
    ).toEqual([{ email: "case@example.test", row_count: 2 }])
    expect(
      results.find((r) => r.id === "missing_user_unique_indexes")?.rows
    ).toHaveLength(2)
    // Warnings only: duplicate users never fail the error-level checks.
    expect(violations(results, "error")).toEqual([])
  })

  it("creates the indexes on a re-run once the duplicates are resolved", async () => {
    await user("a", { username: "dup" })
    const b = await user("b", { username: "dup" })
    await mig.apply(MIGRATION)
    // Only the index whose column has duplicates is skipped.
    expect(await indexNames()).toEqual(["users_email_unique"])

    await sql`UPDATE "bingoscape-next_user" SET username = 'dup2' WHERE id = ${b}`
    await mig.apply(MIGRATION)
    expect((await indexNames()).sort()).toEqual([
      "users_email_unique",
      "users_username_unique",
    ])
  })
})
