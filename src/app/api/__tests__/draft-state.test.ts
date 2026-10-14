/**
 * @jest-environment node
 *
 * `GET /api/events/[id]/draft/state` on real Postgres (team draft 1/4, #215):
 * it authorizes itself, answers a snapshot or the events since a `seq`, and
 * keeps polling cheap with an ETag.
 */
import { asc, eq, sql } from "drizzle-orm"

import { makePick } from "@/app/actions/draft"
import { GET } from "@/app/api/events/[id]/draft/state/route"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { draftPoolEntries, draftTeamSlots, drafts } from "@/server/db/schema"
import { resetRateLimits } from "@/server/rate-limit"
import {
  createDraftWorld,
  startedDraft,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
// The Discord poster has its own tests (draft-discord.test.ts); here it must not
// run on in the background against a database a test is about to clean up.
jest.mock("@/server/draft/discord", () => ({ flushDraftDiscord: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (userId: string | null) =>
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)

let w: DraftWorld

beforeEach(async () => {
  resetRateLimits()
  w = await createDraftWorld({ captains: 3, players: 8 })
})
afterEach(async () => {
  await w.cleanup()
})

const call = (
  eventId: string,
  query = "",
  headers: Record<string, string> = {}
) =>
  GET(
    new Request(`http://localhost/api/events/${eventId}/draft/state${query}`, {
      headers,
    }),
    { params: Promise.resolve({ id: eventId }) }
  )

describe("authorization", () => {
  it("answers 401 without a session, 403 to a non-member and 404 for an unknown Event", async () => {
    signInAs(null)
    expect((await call(w.eventId)).status).toBe(401)
    signInAs(w.outsider)
    expect((await call(w.eventId)).status).toBe(403)
    signInAs(w.owner)
    expect((await call("00000000-0000-4000-8000-000000000000")).status).toBe(
      404
    )
    expect((await call("not-a-uuid")).status).toBe(404)
  })

  it("lets every member read, a plain participant included", async () => {
    await startedDraft(w)
    for (const userId of [w.players[0]!, w.captains[0]!, w.manager, w.owner]) {
      signInAs(userId)
      const response = await call(w.eventId)
      expect(response.status).toBe(200)
    }
  })
})

describe("state", () => {
  it("returns null for an Event without a draft", async () => {
    signInAs(w.players[0]!)
    const response = await call(w.eventId)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ draft: null })
    expect(response.headers.get("ETag")).toBeTruthy()
  })

  it("returns the snapshot with ratings, names and the order", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    signInAs(w.players[0]!)
    const response = await call(w.eventId)
    const body = await response.json()
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
    expect(body.draft).toMatchObject({
      draftId,
      eventId: w.eventId,
      state: {
        status: "in_progress",
        currentPickNo: 1,
        orderType: "snake",
        rounds: 2,
        permutation: [0, 1, 2],
      },
    })
    expect(body.draft.state.slots).toHaveLength(3)
    expect(body.draft.state.pool).toHaveLength(8 + 2) // players, owner, manager
    expect(body.draft.state.pool[0]).toHaveProperty("rating")
    expect(body.draft.players.length).toBeGreaterThan(0)
    expect(body.draft.players[0]).toHaveProperty("name")
    // No email or password hash ever leaves with a name.
    expect(JSON.stringify(body)).not.toMatch(/email|password/i)
  })

  it("answers 304 to a matching ETag and a new one after a change", async () => {
    const { draftId } = await startedDraft(w)
    signInAs(w.players[0]!)
    const first = await call(w.eventId)
    const etag = first.headers.get("ETag")!
    expect(etag).toBeTruthy()

    const again = await call(w.eventId, "", { "If-None-Match": etag })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe("")

    // The on-turn captain picks.
    const [slot] = await db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, draftId))
      .orderBy(asc(draftTeamSlots.position))
    const [entry] = await db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, draftId))
      .orderBy(asc(draftPoolEntries.id))
    signInAs(slot!.captainUserId)
    expect(await makePick({ draftId, poolEntryId: entry!.id })).toMatchObject({
      success: true,
    })

    signInAs(w.players[0]!)
    const changed = await call(w.eventId, "", { "If-None-Match": etag })
    expect(changed.status).toBe(200)
    expect(changed.headers.get("ETag")).not.toBe(etag)
    expect((await changed.json()).draft.state.currentPickNo).toBe(2)
  })

  it("answers only the events since a seq", async () => {
    const { draftId } = await startedDraft(w)
    signInAs(w.players[0]!)
    const all = await (await call(w.eventId, "?since=0")).json()
    expect(all.draft).toMatchObject({ id: draftId, status: "in_progress" })
    expect(all.events.map((e: { type: string }) => e.type)).toEqual([
      "created",
      "started",
    ])
    expect(all.seq).toBe(all.events[1].seq)

    const none = await (await call(w.eventId, `?since=${all.seq}`)).json()
    expect(none.events).toEqual([])
    // A different shape has a different ETag.
    const full = await call(w.eventId)
    const delta = await call(w.eventId, "?since=0")
    expect(full.headers.get("ETag")).not.toBe(delta.headers.get("ETag"))
  })

  it("rejects a bad since", async () => {
    signInAs(w.players[0]!)
    expect((await call(w.eventId, "?since=-1")).status).toBe(400)
    expect((await call(w.eventId, "?since=abc")).status).toBe(400)
    expect((await call(w.eventId, "?since=1.5")).status).toBe(400)
  })
})

describe("the pick timer", () => {
  it("reports database time with the events since a seq", async () => {
    await startedDraft(w, { pickTimerSeconds: 60 })
    signInAs(w.players[0]!)
    const body = await (await call(w.eventId, "?since=0")).json()
    expect(Math.abs(Date.parse(body.serverNow) - Date.now())).toBeLessThan(5000)
    const started = body.events.find(
      (e: { type: string }) => e.type === "started"
    )
    expect(started.payload.deadline).toEqual(expect.any(String))
    expect(started.payload.serverNow).toEqual(expect.any(String))
  })

  it("settles an expired turn when the state is read", async () => {
    const { draftId } = await startedDraft(w, { pickTimerSeconds: 60 })
    signInAs(w.players[0]!)
    await db
      .update(drafts)
      .set({ turnDeadline: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(drafts.id, draftId))

    const body = await (await call(w.eventId)).json()

    expect(body.draft.state.currentPickNo).toBe(2)
    expect(body.draft.state.picks).toHaveLength(1)
    expect(body.draft.state.picks[0]).toMatchObject({
      auto: true,
      reason: "timer_auto",
    })
    expect(Date.parse(body.draft.state.deadline)).toBeGreaterThan(Date.now())
    expect(body.draft.serverNow).toBe(body.draft.state.serverNow)
  })
})
