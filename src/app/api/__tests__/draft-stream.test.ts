/**
 * @jest-environment node
 *
 * `GET /api/events/[id]/draft/stream` on real Postgres (team draft 2/4,
 * #216): LISTEN/NOTIFY delivers pushed events, `Last-Event-ID` and `?since=`
 * replay what was missed, a far-behind client gets a snapshot, members only,
 * and the stream closes at its cap.
 */
import { asc, eq } from "drizzle-orm"

import { cancelDraft, makePick, pauseDraft } from "@/app/actions/draft"
import { GET } from "@/app/api/events/[id]/draft/stream/route"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { draftPoolEntries, draftTeamSlots } from "@/server/db/schema"
import { appendDraftEvent } from "@/server/draft/core"
import { openDraftStreamCount, stopDraftHub } from "@/server/draft/hub"
import { draftStreamConfig } from "@/server/draft/stream"
import { resetRateLimits } from "@/server/rate-limit"
import {
  createDraftWorld,
  startedDraft,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
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

const DEFAULT_CONFIG = { ...draftStreamConfig }

let w: DraftWorld
let controllers: AbortController[] = []

beforeEach(async () => {
  resetRateLimits()
  Object.assign(draftStreamConfig, DEFAULT_CONFIG)
  w = await createDraftWorld({ captains: 3, players: 8 })
})
afterEach(async () => {
  controllers.forEach((c) => c.abort())
  controllers = []
  await stopDraftHub()
  await w.cleanup()
})

interface Frame {
  id?: string
  event?: string
  data?: unknown
  comment?: string
}

/** Reads SSE frames from a response body. */
class SseReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>
  private buffer = ""
  private decoder = new TextDecoder()
  // One read at a time: a read abandoned on timeout must not swallow a chunk.
  private pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null
  done = false

  constructor(response: Response) {
    this.reader = response.body!.getReader()
  }

  private parse(raw: string): Frame {
    const frame: Frame = {}
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) frame.comment = line.slice(1).trim()
      else if (line.startsWith("id: ")) frame.id = line.slice(4)
      else if (line.startsWith("event: ")) frame.event = line.slice(7)
      else if (line.startsWith("data: ")) frame.data = JSON.parse(line.slice(6))
    }
    return frame
  }

  /** The next frame, or null when the stream ended or `timeoutMs` passed. */
  async next(timeoutMs = 3000): Promise<Frame | null> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const split = this.buffer.indexOf("\n\n")
      if (split >= 0) {
        const raw = this.buffer.slice(0, split)
        this.buffer = this.buffer.slice(split + 2)
        return this.parse(raw)
      }
      if (this.done) return null
      const left = deadline - Date.now()
      if (left <= 0) return null
      this.pending ??= this.reader.read()
      const result = await Promise.race([
        this.pending,
        new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), left)
        ),
      ])
      if (result === "timeout") return null
      this.pending = null
      if (result.done) {
        this.done = true
        continue
      }
      this.buffer += this.decoder.decode(result.value, { stream: true })
    }
  }

  /** Frames of the named events, skipping heartbeats, clock frames and the retry hint. */
  async nextEvent(timeoutMs = 3000): Promise<Frame | null> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const frame = await this.next(Math.max(1, deadline - Date.now()))
      if (!frame) return null
      if (frame.event && frame.event !== "clock") return frame
    }
  }

  async collect(count: number, timeoutMs = 3000): Promise<Frame[]> {
    const frames: Frame[] = []
    while (frames.length < count) {
      const frame = await this.nextEvent(timeoutMs)
      if (!frame) break
      frames.push(frame)
    }
    return frames
  }
}

const open = async (
  eventId: string,
  query = "",
  headers: Record<string, string> = {}
) => {
  const controller = new AbortController()
  controllers.push(controller)
  const response = await GET(
    new Request(`http://localhost/api/events/${eventId}/draft/stream${query}`, {
      headers,
      signal: controller.signal,
    }),
    { params: Promise.resolve({ id: eventId }) }
  )
  return { response, controller }
}

const openStream = async (
  eventId: string,
  query = "",
  headers: Record<string, string> = {}
) => {
  const { response, controller } = await open(eventId, query, headers)
  expect(response.status).toBe(200)
  return { reader: new SseReader(response), controller, response }
}

/**
 * The captain on turn picks the next pool entry. Snake order, 3 captains and
 * a permutation of [0, 1, 2]: pick 1 is slot 0, pick 2 is slot 1.
 */
async function pickOne(draftId: string, pickNo = 1) {
  const slots = await db
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draftId))
    .orderBy(asc(draftTeamSlots.position))
  const entries = await db
    .select()
    .from(draftPoolEntries)
    .where(eq(draftPoolEntries.draftId, draftId))
    .orderBy(asc(draftPoolEntries.id))
  signInAs(slots[pickNo - 1]!.captainUserId)
  const result = await makePick({
    draftId,
    poolEntryId: entries[pickNo - 1]!.id,
  })
  expect(result).toMatchObject({ success: true })
  signInAs(w.players[0]!)
}

describe("authorization", () => {
  it("answers 401 without a session, 403 to a non-member and 404 for an unknown Event", async () => {
    await startedDraft(w)
    signInAs(null)
    expect((await open(w.eventId)).response.status).toBe(401)
    signInAs(w.outsider)
    expect((await open(w.eventId)).response.status).toBe(403)
    signInAs(w.owner)
    expect(
      (await open("00000000-0000-4000-8000-000000000000")).response.status
    ).toBe(404)
    expect((await open("not-a-uuid")).response.status).toBe(404)
    expect(openDraftStreamCount()).toBe(0)
  })

  it("answers 404 for an Event without a draft and 400 for a bad since", async () => {
    signInAs(w.players[0]!)
    expect((await open(w.eventId)).response.status).toBe(404)
    await startedDraft(w)
    expect((await open(w.eventId, "?since=-1")).response.status).toBe(400)
    expect((await open(w.eventId, "?since=abc")).response.status).toBe(400)
  })

  it("lets every member in, a plain participant included", async () => {
    await startedDraft(w)
    for (const userId of [w.players[0]!, w.captains[0]!, w.manager, w.owner]) {
      signInAs(userId)
      expect((await open(w.eventId, "?since=0")).response.status).toBe(200)
    }
  })
})

describe("clock frames", () => {
  it("sends database time right after connecting", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId, "?since=0")
    let clock: Frame | null = null
    for (let i = 0; i < 8 && !clock; i++) {
      const frame = await reader.next()
      if (!frame) break
      if (frame.event === "clock") clock = frame
    }
    expect(clock).not.toBeNull()
    const { serverNow } = clock!.data as { serverNow: string }
    expect(Math.abs(Date.parse(serverNow) - Date.now())).toBeLessThan(5000)
    // A clock frame has no id: it must not move Last-Event-ID.
    expect(clock!.id).toBeUndefined()
  })

  it("repeats it with every heartbeat", async () => {
    draftStreamConfig.heartbeatMs = 50
    await startedDraft(w)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId, "?since=0")
    let clocks = 0
    for (let i = 0; i < 40 && clocks < 3; i++) {
      const frame = await reader.next(1000)
      if (!frame) break
      if (frame.event === "clock") clocks += 1
    }
    expect(clocks).toBeGreaterThanOrEqual(3)
  })
})

describe("the stream", () => {
  it("sends the SSE headers and a retry hint", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    const { response, reader } = await openStream(w.eventId, "?since=0")
    expect(response.headers.get("Content-Type")).toMatch(/^text\/event-stream/)
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(response.headers.get("X-Accel-Buffering")).toBe("no")
    const first = await reader.next()
    expect(first).toEqual({})
  })

  it("replays the events after ?since and then delivers a new pick live", async () => {
    const { draftId } = await startedDraft(w)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId, "?since=0")

    const replay = await reader.collect(2)
    expect(replay.map((f) => f.event)).toEqual(["draft", "draft"])
    expect(replay.map((f) => (f.data as { type: string }).type)).toEqual([
      "created",
      "started",
    ])
    // The id of each frame is the seq, so the browser can resume from it.
    expect(replay.map((f) => Number(f.id))).toEqual(
      replay.map((f) => (f.data as { seq: number }).seq)
    )

    // Nothing else is pending; a pick then arrives through LISTEN/NOTIFY.
    expect(await reader.nextEvent(300)).toBeNull()
    await pickOne(draftId)
    const live = await reader.nextEvent()
    expect(live?.event).toBe("draft")
    expect(live?.data).toMatchObject({
      type: "pick",
      payload: { pickNo: 1 },
    })
  })

  it("lets Last-Event-ID win over ?since and replays only what was missed", async () => {
    const { draftId } = await startedDraft(w)
    await pickOne(draftId)
    signInAs(w.players[0]!)
    const all = await (
      await openStream(w.eventId, "?since=0")
    ).reader.collect(3)
    const startedSeq = (all[1]!.data as { seq: number }).seq

    const { reader } = await openStream(w.eventId, "?since=0", {
      "Last-Event-ID": String(startedSeq),
    })
    const frames = await reader.collect(2, 500)
    expect(frames).toHaveLength(1)
    expect(frames[0]!.data).toMatchObject({ type: "pick" })
  })

  it("sends a reset snapshot when the client gives no position", async () => {
    const { draftId } = await startedDraft(w)
    await pickOne(draftId)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId)
    const frame = await reader.nextEvent()
    expect(frame?.event).toBe("reset")
    const snapshot = (
      frame!.data as {
        draft: {
          draftId: string
          state: { lastSeq: number; currentPickNo: number }
          players: unknown[]
        }
      }
    ).draft
    expect(snapshot.draftId).toBe(draftId)
    expect(snapshot.state.currentPickNo).toBe(2)
    expect(frame?.id).toBe(String(snapshot.state.lastSeq))
    expect(snapshot.players.length).toBeGreaterThan(0)
    expect(JSON.stringify(frame)).not.toMatch(/email|password/i)

    // From the snapshot on, new events follow without a gap or a repeat.
    await pickOne(draftId, 2)
    const next = await reader.nextEvent()
    expect(next?.data).toMatchObject({ type: "pick", payload: { pickNo: 2 } })
  })

  it("sends a reset when the client is too far behind or ahead of the log", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)

    draftStreamConfig.maxReplay = 1
    const behind = await openStream(w.eventId, "?since=0")
    expect((await behind.reader.nextEvent())?.event).toBe("reset")
    behind.controller.abort()

    draftStreamConfig.maxReplay = 200
    const ahead = await openStream(w.eventId, "?since=999999999999")
    expect((await ahead.reader.nextEvent())?.event).toBe("reset")
  })

  it("does not deliver events of a rolled back transaction", async () => {
    const { draftId } = await startedDraft(w)
    signInAs(w.players[0]!)
    const stamp = await (
      await openStream(w.eventId, "?since=0")
    ).reader.collect(2)
    const { reader } = await openStream(
      w.eventId,
      `?since=${(stamp[1]!.data as { seq: number }).seq}`
    )

    await db
      .transaction(async (tx) => {
        await appendDraftEvent(tx, draftId, "paused", null, {})
        tx.rollback()
      })
      .catch(() => undefined)
    expect(await reader.nextEvent(400)).toBeNull()
  })

  it("sends heartbeats", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    draftStreamConfig.heartbeatMs = 30
    const { reader } = await openStream(w.eventId, "?since=999999999999")
    await reader.nextEvent() // the reset
    const heartbeat = await reader.next()
    expect(heartbeat?.comment).toBe("heartbeat")
  })

  it("closes at its cap with bye, so the client reconnects", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    draftStreamConfig.maxLifetimeMs = 100
    draftStreamConfig.lifetimeJitterMs = 0
    const { reader } = await openStream(w.eventId, "?since=999999999999")
    await reader.nextEvent() // the reset
    const bye = await reader.nextEvent()
    expect(bye).toMatchObject({ event: "bye", data: { reason: "cap" } })
    expect(await reader.next()).toBeNull()
    expect(reader.done).toBe(true)
    expect(openDraftStreamCount()).toBe(0)
  })

  it("ends after the draft is cancelled", async () => {
    const { draftId } = await startedDraft(w)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId, "?since=0")
    await reader.collect(2)

    signInAs(w.manager)
    expect(await pauseDraft({ draftId })).toMatchObject({ success: true })
    expect((await reader.nextEvent())?.data).toMatchObject({ type: "paused" })
    expect(await cancelDraft({ draftId })).toMatchObject({ success: true })
    expect((await reader.nextEvent())?.data).toMatchObject({
      type: "cancelled",
    })
    expect(await reader.nextEvent()).toMatchObject({
      event: "bye",
      data: { reason: "done" },
    })
    expect(await reader.next()).toBeNull()
    expect(reader.done).toBe(true)
    expect(openDraftStreamCount()).toBe(0)
  })

  it("unsubscribes when the client goes away", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    const { controller, reader } = await openStream(w.eventId, "?since=0")
    await reader.collect(2)
    expect(openDraftStreamCount()).toBe(1)
    controller.abort()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(openDraftStreamCount()).toBe(0)
  })

  it("allows 3 streams per user and answers 429 for a 4th", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    const first = await openStream(w.eventId, "?since=0")
    await openStream(w.eventId, "?since=0")
    await openStream(w.eventId, "?since=0")
    expect(openDraftStreamCount()).toBe(3)

    const fourth = await open(w.eventId, "?since=0")
    expect(fourth.response.status).toBe(429)
    expect(await fourth.response.json()).toMatchObject({
      code: "STREAM_LIMIT",
    })

    // Another user is not affected, and a freed slot can be used again.
    signInAs(w.players[1]!)
    expect((await open(w.eventId, "?since=0")).response.status).toBe(200)
    first.controller.abort()
    await new Promise((resolve) => setTimeout(resolve, 50))
    signInAs(w.players[0]!)
    expect((await open(w.eventId, "?since=0")).response.status).toBe(200)
  })

  it("closes every stream with bye on shutdown", async () => {
    await startedDraft(w)
    signInAs(w.players[0]!)
    const { reader } = await openStream(w.eventId, "?since=999999999999")
    await reader.nextEvent()
    const { closeAllDraftStreams } = await import("@/server/draft/hub")
    closeAllDraftStreams("shutdown")
    expect(await reader.nextEvent()).toMatchObject({
      event: "bye",
      data: { reason: "shutdown" },
    })
    expect(reader.done).toBe(false) // the end of the body follows
    expect(await reader.next()).toBeNull()
    expect(reader.done).toBe(true)
  })
})
