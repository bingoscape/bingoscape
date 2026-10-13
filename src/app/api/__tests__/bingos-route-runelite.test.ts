/**
 * @jest-environment node
 */
import { eq, and } from "drizzle-orm"
import { NextRequest } from "next/server"

import { GET as getBingo } from "@/app/api/runelite/bingos/[bingoId]/route"
import { GET as getEvents } from "@/app/api/runelite/events/route"
import { validateApiKey } from "@/lib/api-auth"
import { type FormattedBingo } from "@/lib/bingo-formatter"
import { db } from "@/server/db"
import {
  bingos,
  eventParticipants,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import {
  createBlindFixture,
  expectNoSecrets,
  expectSecret,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"
import {
  setClock,
  validFleet,
} from "@/server/__tests__/helpers/battleship-fixture"
import { battleshipShips, battleshipShipTiles } from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/api-auth", () => ({ validateApiKey: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const apiKeyUser = validateApiKey as jest.Mock

afterEach(() => {
  jest.useRealTimers()
})

function boardRequest(bingoId: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/runelite/bingos/${bingoId}`, {
    headers,
  })
}

async function fetchBoard(
  userId: string,
  bingoId: string,
  headers: Record<string, string> = {}
) {
  apiKeyUser.mockResolvedValue(userId)
  return getBingo(boardRequest(bingoId, headers), {
    params: Promise.resolve({ bingoId }),
  })
}

async function placeFleet(
  teamId: string,
  bingoId: string,
  fleet: Array<{ length: number; tileIds: string[] }>
) {
  for (const ship of fleet) {
    const [row] = await db
      .insert(battleshipShips)
      .values({ bingoId, teamId, shipLength: ship.length })
      .returning({ id: battleshipShips.id })
    await db
      .insert(battleshipShipTiles)
      .values(
        ship.tileIds.map((tileId) => ({ shipId: row!.id, teamId, tileId }))
      )
  }
}

describe("GET /api/runelite/bingos/[bingoId]", () => {
  let fx: BlindFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture()
    await placeFleet(fx.teamAId, fx.bingoId, validFleet(fx.tileIds, 0))
    await placeFleet(fx.teamBId, fx.bingoId, validFleet(fx.tileIds, 1))
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  describe("authentication", () => {
    it("answers 401 without a valid key", async () => {
      apiKeyUser.mockResolvedValue(null)
      const response = await getBingo(boardRequest(fx.bingoId), {
        params: Promise.resolve({ bingoId: fx.bingoId }),
      })
      expect(response.status).toBe(401)
    })
  })

  describe("access", () => {
    it("serves a battleship board to a team member (no more 404)", async () => {
      setClock(fx.clock.afterStart)
      const response = await fetchBoard(fx.memberAId, fx.bingoId)

      expect(response.status).toBe(200)
      const body = (await response.json()) as FormattedBingo
      expect(body).toMatchObject({
        apiVersion: "2.1",
        bingoType: "battleship",
        id: fx.bingoId,
      })
      expect(body.battleship).toBeDefined()
    })

    it("serves a participant who is on no team", async () => {
      setClock(fx.clock.afterStart)
      const response = await fetchBoard(fx.outsiderId, fx.bingoId)
      expect(response.status).toBe(200)
    })

    it("serves the event's manager", async () => {
      setClock(fx.clock.beforeStart)
      const response = await fetchBoard(fx.managerId, fx.bingoId)

      expect(response.status).toBe(200)
      const body = (await response.json()) as FormattedBingo
      expectSecret(body, fx.titleOf(0))
    })

    it("serves the creator even without a participant row", async () => {
      await db
        .delete(eventParticipants)
        .where(
          and(
            eq(eventParticipants.eventId, fx.eventId),
            eq(eventParticipants.userId, fx.managerId)
          )
        )
      const response = await fetchBoard(fx.managerId, fx.bingoId)
      expect(response.status).toBe(200)
    })

    it("answers 404 to a user who is not in the event", async () => {
      const other = await createBlindFixture()
      try {
        const response = await fetchBoard(other.memberAId, fx.bingoId)
        expect(response.status).toBe(404)
        const body = await response.json()
        expect(body).toEqual({ error: "Bingo not found" })
        expectNoSecrets(body, fx.secrets)
      } finally {
        await other.cleanup()
      }
    })

    it("answers the same 404 for a board that does not exist", async () => {
      const unknown = "00000000-0000-4000-8000-000000000000"
      const response = await fetchBoard(fx.memberAId, unknown)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: "Bingo not found" })
    })

    describe("a hidden board", () => {
      beforeEach(async () => {
        await db
          .update(bingos)
          .set({ visible: false })
          .where(eq(bingos.id, fx.bingoId))
      })

      it("is a 404 for a participant", async () => {
        const response = await fetchBoard(fx.memberAId, fx.bingoId)
        expect(response.status).toBe(404)
        expectNoSecrets(await response.json(), fx.secrets)
      })

      it("is served to the manager", async () => {
        const response = await fetchBoard(fx.managerId, fx.bingoId)
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ visible: false })
      })
    })
  })

  describe("the battleship body", () => {
    it("carries no secret before the start", async () => {
      setClock(fx.clock.beforeStart)
      const response = await fetchBoard(fx.memberAId, fx.bingoId)

      expect(response.status).toBe(200)
      const body = (await response.json()) as FormattedBingo
      expect(body.tiles.every((tile) => tile.isBlind)).toBe(true)
      expect(body.battleship).toMatchObject({
        started: false,
        marks: { hitTileIds: [], missTileIds: [], sunkTileIds: [] },
      })
      expectNoSecrets(body, fx.secrets)
      expectNoSecrets(body, [`/uploads/secret-${fx.tag}`])
    })

    it("serializes dates as ISO strings and sorts the rules by length", async () => {
      setClock(fx.clock.afterStart)
      const body = (await (
        await fetchBoard(fx.memberAId, fx.bingoId)
      ).json()) as unknown as {
        battleship: {
          startDate: string
          serverNow: string
          rules: Array<{ length: number; count: number }>
        }
      }

      expect(body.battleship.startDate).toBe(fx.startDate.toISOString())
      expect(body.battleship.serverNow).toBe(fx.clock.afterStart.toISOString())
      expect(body.battleship.rules).toEqual([
        { length: 2, count: 1 },
        { length: 3, count: 1 },
      ])
    })

    it("names no opponent ship tile", async () => {
      const t = fx.tileIds
      await db.insert(teamTileSubmissions).values({
        teamId: fx.teamAId,
        tileId: t[7]!,
        status: "completed",
        completedAt: new Date(),
      })
      setClock(fx.clock.afterStart)

      const body = await (await fetchBoard(fx.memberAId, fx.bingoId)).json()
      const outsideTiles = JSON.stringify({ ...body, tiles: undefined })

      for (const opponentTile of [t[2]!, t[5]!, t[8]!, t[3]!, t[4]!]) {
        expect(outsideTiles).not.toContain(opponentTile)
      }
    })
  })

  describe("caching", () => {
    it("sends a quoted ETag and private, no-cache", async () => {
      setClock(fx.clock.afterStart)
      const response = await fetchBoard(fx.memberAId, fx.bingoId)

      expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{32}"$/)
      expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
    })

    it("keeps the ETag across calls although serverNow changes", async () => {
      setClock(fx.clock.afterStart)
      const first = await fetchBoard(fx.memberAId, fx.bingoId)
      setClock(new Date(fx.clock.afterStart.getTime() + 30_000))
      const second = await fetchBoard(fx.memberAId, fx.bingoId)

      const [a, b] = [
        (await first.json()) as FormattedBingo,
        (await second.json()) as FormattedBingo,
      ]
      expect(a.battleship!.serverNow).not.toEqual(b.battleship!.serverNow)
      expect(second.headers.get("ETag")).toBe(first.headers.get("ETag"))
    })

    it("changes the ETag when the board changes", async () => {
      setClock(fx.clock.afterStart)
      const before = await fetchBoard(fx.memberAId, fx.bingoId)
      await db.insert(teamTileSubmissions).values({
        teamId: fx.teamAId,
        tileId: fx.tileIds[2]!,
        status: "completed",
        completedAt: new Date(),
      })
      const after = await fetchBoard(fx.memberAId, fx.bingoId)

      expect(after.headers.get("ETag")).not.toBe(before.headers.get("ETag"))
    })

    it("gives users with different views different ETags", async () => {
      setClock(fx.clock.afterStart)
      await db.insert(teamTileSubmissions).values({
        teamId: fx.teamAId,
        tileId: fx.tileIds[2]!,
        status: "completed",
        completedAt: new Date(),
      })

      const teamA = await fetchBoard(fx.memberAId, fx.bingoId)
      const teamB = await fetchBoard(fx.memberBId, fx.bingoId)
      const manager = await fetchBoard(fx.managerId, fx.bingoId)

      const etags = [teamA, teamB, manager].map((r) => r.headers.get("ETag"))
      expect(new Set(etags).size).toBe(3)
    })

    it("answers 304 without a body when If-None-Match matches", async () => {
      setClock(fx.clock.afterStart)
      const first = await fetchBoard(fx.memberAId, fx.bingoId)
      const etag = first.headers.get("ETag")!

      setClock(new Date(fx.clock.afterStart.getTime() + 30_000))
      const second = await fetchBoard(fx.memberAId, fx.bingoId, {
        "If-None-Match": etag,
      })

      expect(second.status).toBe(304)
      expect(await second.text()).toBe("")
      expect(second.headers.get("ETag")).toBe(etag)
      expect(second.headers.get("Cache-Control")).toBe("private, no-cache")
    })

    it("matches weak validators and lists", async () => {
      setClock(fx.clock.afterStart)
      const etag = (await fetchBoard(fx.memberAId, fx.bingoId)).headers.get(
        "ETag"
      )!

      const weak = await fetchBoard(fx.memberAId, fx.bingoId, {
        "If-None-Match": `"other", W/${etag}`,
      })
      expect(weak.status).toBe(304)
    })

    it("sends the full body when If-None-Match is stale", async () => {
      setClock(fx.clock.afterStart)
      const response = await fetchBoard(fx.memberAId, fx.bingoId, {
        "If-None-Match": '"stale"',
      })
      expect(response.status).toBe(200)
      expect(((await response.json()) as FormattedBingo).id).toBe(fx.bingoId)
    })

    it("does not serve another user's ETag as a 304", async () => {
      setClock(fx.clock.afterStart)
      await db.insert(teamTileSubmissions).values({
        teamId: fx.teamAId,
        tileId: fx.tileIds[2]!,
        status: "completed",
        completedAt: new Date(),
      })
      const etagA = (await fetchBoard(fx.memberAId, fx.bingoId)).headers.get(
        "ETag"
      )!

      const asB = await fetchBoard(fx.memberBId, fx.bingoId, {
        "If-None-Match": etagA,
      })
      expect(asB.status).toBe(200)
    })

    it("does not skip the access check on a matching ETag", async () => {
      setClock(fx.clock.afterStart)
      const etag = (await fetchBoard(fx.memberAId, fx.bingoId)).headers.get(
        "ETag"
      )!
      const other = await createBlindFixture()
      try {
        const response = await fetchBoard(other.memberAId, fx.bingoId, {
          "If-None-Match": etag,
        })
        expect(response.status).toBe(404)
      } finally {
        await other.cleanup()
      }
    })
  })

  describe("rate limit", () => {
    it("answers 429 with Retry-After after 60 calls a minute, per user", async () => {
      for (let i = 0; i < 60; i++) {
        const ok = await fetchBoard(fx.outsiderId, fx.bingoId)
        expect(ok.status).toBe(200)
      }

      const limited = await fetchBoard(fx.outsiderId, fx.bingoId)
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThanOrEqual(
        1
      )
      expect(Number(limited.headers.get("Retry-After"))).toBeLessThanOrEqual(60)
      expect(await limited.json()).toEqual({ error: "Too many requests" })

      // Other users have their own budget.
      expect((await fetchBoard(fx.memberAId, fx.bingoId)).status).toBe(200)
    }, 60_000)
  })
})

describe("other board types", () => {
  it("serves a standard board without battleship or progression", async () => {
    const standard = await createBlindFixture({ bingoType: "standard" })
    try {
      const response = await fetchBoard(standard.memberAId, standard.bingoId)
      expect(response.status).toBe(200)
      const body = (await response.json()) as FormattedBingo
      expect(body).toMatchObject({ apiVersion: "2.1", bingoType: "standard" })
      expect(body.battleship).toBeUndefined()
      expect(body.progression).toBeUndefined()
      expect(response.headers.get("ETag")).toBeTruthy()
    } finally {
      await standard.cleanup()
    }
  })
})

describe("GET /api/runelite/events", () => {
  let fx: BlindFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture()
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  it("lists boards of every type, each with its bingoType", async () => {
    for (const bingoType of ["standard", "progression"] as const) {
      const [bingo] = await db
        .insert(bingos)
        .values({
          eventId: fx.eventId,
          title: `${bingoType} board`,
          rows: 1,
          columns: 1,
          codephrase: "codephrase",
          bingoType,
          visible: true,
        })
        .returning({ id: bingos.id })
      await db.insert(tiles).values({
        bingoId: bingo!.id,
        title: "Only tile",
        description: "Only tile",
        weight: 1,
        index: 0,
      })
    }
    setClock(fx.clock.afterStart)
    apiKeyUser.mockResolvedValue(fx.memberAId)

    const response = await getEvents(
      new Request("http://localhost/api/runelite/events")
    )

    expect(response.status).toBe(200)
    const events = (await response.json()) as Array<{
      id: string
      bingos: FormattedBingo[]
    }>
    const event = events.find((e) => e.id === fx.eventId)!
    expect(event.bingos.map((b) => b.bingoType).sort()).toEqual([
      "battleship",
      "progression",
      "standard",
    ])
    expect(event.bingos.every((b) => b.apiVersion === "2.1")).toBe(true)
    expect(
      event.bingos.find((b) => b.bingoType === "battleship")!.battleship
    ).toBeDefined()
  })

  it("keeps a battleship board blind before the start", async () => {
    setClock(fx.clock.beforeStart)
    apiKeyUser.mockResolvedValue(fx.memberAId)

    const response = await getEvents(
      new Request("http://localhost/api/runelite/events")
    )
    const body = await response.json()

    expect(JSON.stringify(body)).toContain("battleship")
    expectNoSecrets(body, fx.secrets)
  })

  it("still hides boards that are not visible", async () => {
    await db
      .update(bingos)
      .set({ visible: false })
      .where(eq(bingos.id, fx.bingoId))
    apiKeyUser.mockResolvedValue(fx.memberAId)

    const response = await getEvents(
      new Request("http://localhost/api/runelite/events")
    )
    const events = (await response.json()) as Array<{ id: string }>

    expect(events.find((e) => e.id === fx.eventId)).toBeUndefined()
  })
})
