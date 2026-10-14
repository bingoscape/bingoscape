/**
 * @jest-environment node
 *
 * `GET /api/events/[id]/draft/recap-image` on real Postgres (team draft 4/4,
 * #218): members only, only once the draft is finished, answers a PNG.
 */
import { and, asc, eq } from "drizzle-orm"

import { GET } from "@/app/api/events/[id]/draft/recap-image/route"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { draftPoolEntries } from "@/server/db/schema"
import { performPick, type Tx } from "@/server/draft/core"
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

// `next/og` renders through a dynamic import that Jest cannot run; the route
// is checked up to the image it asks for (what is drawn is covered by
// recap-image-element.test.tsx).
const mockRendered: { element?: unknown; width?: number; height?: number } = {}
jest.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(
      element: unknown,
      options: { width: number; height: number; headers?: HeadersInit }
    ) {
      mockRendered.element = element
      mockRendered.width = options.width
      mockRendered.height = options.height
      super(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
        headers: { "Content-Type": "image/png", ...options.headers },
      })
    }
  },
}))

const session = getServerAuthSession as jest.Mock
const signInAs = (userId: string | null) =>
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)

let w: DraftWorld

beforeEach(async () => {
  resetRateLimits()
  w = await createDraftWorld({ captains: 2, players: 6 })
})
afterEach(async () => {
  await w.cleanup()
})

const call = (eventId: string, query = "") =>
  GET(
    new Request(
      `http://localhost/api/events/${eventId}/draft/recap-image${query}`
    ),
    { params: Promise.resolve({ id: eventId }) }
  )

async function finishDraft(draftId: string) {
  const manager = await w.actorOf(w.manager)
  for (let i = 0; i < 2; i += 1) {
    const [entry] = await db
      .select()
      .from(draftPoolEntries)
      .where(
        and(
          eq(draftPoolEntries.draftId, draftId),
          eq(draftPoolEntries.status, "available")
        )
      )
      .orderBy(asc(draftPoolEntries.id))
      .limit(1)
    const result = await db.transaction((tx) =>
      performPick(tx as Tx, {
        draftId,
        poolEntryId: entry!.id,
        actor: manager,
        force: true,
      })
    )
    if (!result.success) throw new Error(result.error)
  }
}

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
  })
})

describe("the image", () => {
  it("is not there before the draft is finished", async () => {
    await startedDraft(w, { rounds: 1 })
    signInAs(w.players[0]!)
    expect((await call(w.eventId)).status).toBe(404)
  })

  it("is not there for an Event without a draft", async () => {
    signInAs(w.players[0]!)
    expect((await call(w.eventId)).status).toBe(404)
  })

  it("is a PNG of the final rosters for any member", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1 })
    await finishDraft(draftId)
    signInAs(w.players[0]!)
    const response = await call(w.eventId)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
    expect(response.headers.get("Content-Disposition")).toBeNull()
    const bytes = new Uint8Array(await response.arrayBuffer())
    // The PNG signature of the stand-in.
    expect([...bytes.slice(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    expect(mockRendered.width).toBe(1200)
    expect(mockRendered.height).toBeGreaterThan(200)
    expect(mockRendered.element).toBeTruthy()
  })

  it("is offered as a download on request", async () => {
    const { draftId } = await startedDraft(w, { rounds: 1 })
    await finishDraft(draftId)
    signInAs(w.captains[0]!)
    const response = await call(w.eventId, "?download=1")
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="team-draft.png"'
    )
  })
})
