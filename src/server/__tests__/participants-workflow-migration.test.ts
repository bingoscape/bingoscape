/**
 * @jest-environment node
 *
 * Migration 0041 (participants workflow 2/N) applied to a real Postgres
 * database that is first brought to the state of migration 0040 and seeded the
 * way the previous app version leaves it (duplicate pending requests, duplicate
 * buy-in rows). Each test gets its own throwaway database.
 */
import postgres from "postgres"

import { createMigrationDb, type MigrationDb } from "./helpers/migration-db"

const MIGRATION = "0041_participants_workflow_expand"
const PREVIOUS = "0040_credential_session_hygiene"

// beforeEach replays every earlier migration, which is slow under a loaded run.
jest.setTimeout(60_000)

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

async function event(name: string, ownerId: string, minimumBuyIn: number) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_events" (name, start_date, end_date, creator_id, "minimumBuyIn")
    VALUES (${name}, now(), now() + interval '1 day', ${ownerId}, ${minimumBuyIn})
    RETURNING id`
  return row!.id
}

async function participant(eventId: string, userId: string) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_event_participants" (event_id, user_id, role)
    VALUES (${eventId}, ${userId}, 'participant'::event_role)
    RETURNING id`
  return row!.id
}

async function buyIn(participantId: string, amount: number, updatedAt: string) {
  await sql`
    INSERT INTO "bingoscape-next_event_buy_ins" (event_participant_id, amount, created_at, updated_at)
    VALUES (${participantId}, ${amount}, ${updatedAt}, ${updatedAt})`
}

async function request(
  eventId: string,
  userId: string,
  status: "pending" | "approved" | "rejected",
  createdAt: string
) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO "bingoscape-next_event_registration_requests"
      (event_id, user_id, status, created_at, updated_at)
    VALUES (${eventId}, ${userId}, ${status}::registration_status, ${createdAt}, ${createdAt})
    RETURNING id`
  return row!.id
}

const buyIns = (participantId: string) =>
  sql<{ amount: string; expected_amount: string | null }[]>`
    SELECT amount::text, expected_amount::text
    FROM "bingoscape-next_event_buy_ins"
    WHERE event_participant_id = ${participantId}
    ORDER BY created_at`

const requests = (eventId: string) =>
  sql<{ id: string; status: string; admin_notes: string | null }[]>`
    SELECT id, status::text, admin_notes
    FROM "bingoscape-next_event_registration_requests"
    WHERE event_id = ${eventId}
    ORDER BY created_at, id`

describe("migration 0041", () => {
  it("collapses duplicate buy-in rows to the most recently updated one", async () => {
    const owner = await user("owner")
    const player = await user("player")
    const evt = await event("Dupes", owner, 100)
    const pid = await participant(evt, player)
    await buyIn(pid, 100, "2026-01-01T10:00:00Z")
    await buyIn(pid, 0, "2026-01-02T10:00:00Z")
    await buyIn(pid, 100, "2026-01-01T12:00:00Z")

    await mig.apply(MIGRATION)

    expect(await buyIns(pid)).toEqual([{ amount: "0", expected_amount: "100" }])
  })

  it("backfills expected_amount with the Event's current minimum buy-in", async () => {
    const owner = await user("owner")
    const a = await user("a")
    const b = await user("b")
    const evtA = await event("A", owner, 250)
    const evtB = await event("B", owner, 0)
    const pa = await participant(evtA, a)
    const pb = await participant(evtB, b)
    await buyIn(pa, 250, "2026-01-01T10:00:00Z")
    await buyIn(pb, 0, "2026-01-01T10:00:00Z")

    await mig.apply(MIGRATION)

    expect(await buyIns(pa)).toEqual([
      { amount: "250", expected_amount: "250" },
    ])
    expect(await buyIns(pb)).toEqual([{ amount: "0", expected_amount: "0" }])
  })

  it("keeps the oldest of several pending requests and closes the rest with a note", async () => {
    const owner = await user("owner")
    const applicant = await user("applicant")
    const evt = await event("Requests", owner, 0)
    const first = await request(
      evt,
      applicant,
      "pending",
      "2026-01-01T10:00:00Z"
    )
    const second = await request(
      evt,
      applicant,
      "pending",
      "2026-01-02T10:00:00Z"
    )
    const third = await request(
      evt,
      applicant,
      "pending",
      "2026-01-03T10:00:00Z"
    )
    const earlierRejected = await request(
      evt,
      applicant,
      "rejected",
      "2025-12-01T10:00:00Z"
    )

    await mig.apply(MIGRATION)

    const rows = await requests(evt)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId[first]?.status).toBe("pending")
    expect(byId[first]?.admin_notes).toBeNull()
    expect(byId[second]?.status).toBe("rejected")
    expect(byId[second]?.admin_notes).toMatch(/duplicate pending request/i)
    expect(byId[third]?.status).toBe("rejected")
    expect(byId[earlierRejected]?.status).toBe("rejected")
    expect(byId[earlierRejected]?.admin_notes).toBeNull()
  })

  it("does not touch pending requests of different users or events", async () => {
    const owner = await user("owner")
    const u1 = await user("u1")
    const u2 = await user("u2")
    const evtA = await event("A", owner, 0)
    const evtB = await event("B", owner, 0)
    await request(evtA, u1, "pending", "2026-01-01T10:00:00Z")
    await request(evtA, u2, "pending", "2026-01-01T10:00:00Z")
    await request(evtB, u1, "pending", "2026-01-01T10:00:00Z")

    await mig.apply(MIGRATION)

    const pending = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "bingoscape-next_event_registration_requests"
      WHERE status = 'pending'`
    expect(pending[0]?.n).toBe(3)
  })

  it("enforces one pending request and one buy-in row per participant afterwards", async () => {
    const owner = await user("owner")
    const player = await user("player")
    const evt = await event("Constraints", owner, 100)
    const pid = await participant(evt, player)
    await mig.apply(MIGRATION)

    await request(evt, player, "pending", "2026-01-01T10:00:00Z")
    await expect(
      request(evt, player, "pending", "2026-01-02T10:00:00Z")
    ).rejects.toThrow(/event_registration_requests_pending_unique/)
    // A closed request does not block a new one.
    await sql`UPDATE "bingoscape-next_event_registration_requests" SET status = 'rejected'`
    await request(evt, player, "pending", "2026-01-03T10:00:00Z")

    await buyIn(pid, 100, "2026-01-01T10:00:00Z")
    await expect(buyIn(pid, 100, "2026-01-02T10:00:00Z")).rejects.toThrow(
      /event_buy_ins_participant_unique/
    )
  })

  it("still accepts what the previous app version writes", async () => {
    const owner = await user("owner")
    const player = await user("player")
    const applicant = await user("applicant")
    const evt = await event("Old app", owner, 100)
    const pid = await participant(evt, player)
    await mig.apply(MIGRATION)

    // Previous app: a single buy-in row without expected_amount, a single
    // pending request with no new columns.
    await buyIn(pid, 100, "2026-02-01T10:00:00Z")
    await request(evt, applicant, "pending", "2026-02-01T10:00:00Z")

    expect(await buyIns(pid)).toEqual([
      { amount: "100", expected_amount: null },
    ])
    expect(await requests(evt)).toHaveLength(1)
  })

  it("creates team_generation_runs with a previewed default and the new indexes", async () => {
    const owner = await user("owner")
    const evt = await event("Runs", owner, 0)
    await mig.apply(MIGRATION)

    const [run] = await sql<{ status: string; applied_at: Date | null }[]>`
      INSERT INTO "bingoscape-next_team_generation_runs" (event_id, created_by, config, plan)
      VALUES (${evt}, ${owner}, '{"teamCount":2}'::jsonb, '[]'::jsonb)
      RETURNING status::text, applied_at`
    expect(run).toEqual({ status: "previewed", applied_at: null })

    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'team_generation_runs_event_created_idx',
        'event_donations_participant_idx',
        'player_metadata_event_idx',
        'event_registration_requests_event_status_idx'
      )`
    expect(indexes).toHaveLength(4)
  })

  it("is idempotent", async () => {
    const owner = await user("owner")
    const player = await user("player")
    const evt = await event("Twice", owner, 100)
    const pid = await participant(evt, player)
    await buyIn(pid, 100, "2026-01-01T10:00:00Z")
    await request(evt, player, "pending", "2026-01-01T10:00:00Z")

    await mig.apply(MIGRATION)
    await mig.apply(MIGRATION)

    expect(await buyIns(pid)).toEqual([
      { amount: "100", expected_amount: "100" },
    ])
  })
})
