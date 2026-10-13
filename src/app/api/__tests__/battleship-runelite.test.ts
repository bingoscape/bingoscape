/**
 * @jest-environment node
 */
import { and, count, eq, inArray } from "drizzle-orm"

import { POST as submitTile } from "@/app/api/runelite/tiles/[tileId]/submissions/route"
import { POST as autoSubmitTile } from "@/app/api/runelite/tiles/[tileId]/auto-submissions/route"
import { validateApiKey } from "@/lib/api-auth"
import { formatBingoData, type FormattedBingo } from "@/lib/bingo-formatter"
import { markForTile, toMarkSets } from "@/lib/battleship-marks"
import { db } from "@/server/db"
import {
  battleshipShips,
  battleshipShipTiles,
  bingos,
  goals,
  itemGoals,
  submissions,
  teamMembers,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import { getBattleshipBoardStateForTeam } from "@/server/battleship"
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

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/lib/api-auth", () => ({ validateApiKey: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
// Never touch the real uploads directory.
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    access: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    writeFile: jest.fn(async () => undefined),
  },
}))

const apiKeyUser = validateApiKey as jest.Mock

afterEach(() => {
  jest.useRealTimers()
})

const sorted = (ids: string[]) => [...ids].sort()
const itemIdOf = (index: number) => 7000 + index

function imageRequest(url: string, metadata?: unknown): Request {
  const form = new FormData()
  form.set("image", new File(["png"], "drop.png", { type: "image/png" }))
  if (metadata) form.set("metadata", JSON.stringify(metadata))
  return new Request(url, { method: "POST", body: form })
}

const tileParams = (tileId: string) => ({ params: Promise.resolve({ tileId }) })

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

async function complete(teamId: string, tileId: string) {
  await db
    .insert(teamTileSubmissions)
    .values({ teamId, tileId, status: "completed", completedAt: new Date() })
    .onConflictDoUpdate({
      target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
      set: { status: "completed" },
    })
}

/** Replaces the goals of the tiles with one item goal each (one drop completes it). */
async function giveItemGoals(fx: BlindFixture, indexes: number[]) {
  await db.delete(goals).where(
    inArray(
      goals.tileId,
      indexes.map((i) => fx.tileIds[i]!)
    )
  )
  for (const index of indexes) {
    const [goal] = await db
      .insert(goals)
      .values({
        tileId: fx.tileIds[index]!,
        description: `Plain goal ${index}`,
        targetValue: 1,
        goalType: "item",
      })
      .returning({ id: goals.id })
    await db.insert(itemGoals).values({
      goalId: goal!.id,
      itemId: itemIdOf(index),
      baseName: `Plain item ${index}`,
      imageUrl: `https://example.test/plain-${index}.png`,
    })
  }
}

describe("battleship board over the RuneLite API", () => {
  let fx: BlindFixture
  // Team A ships: 0,3,6 (length 3) and 4,5 (length 2).
  // Team B ships: 2,5,8 (length 3) and 3,4 (length 2).
  let t: string[]

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture()
    t = fx.tileIds
    await placeFleet(fx.teamAId, fx.bingoId, validFleet(t, 0))
    await placeFleet(fx.teamBId, fx.bingoId, validFleet(t, 1))
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  async function format(userId: string): Promise<FormattedBingo> {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, fx.bingoId),
    })
    const membership = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, userId),
      with: {
        team: {
          with: {
            teamMembers: {
              with: { user: { columns: { runescapeName: true } } },
            },
          },
        },
      },
    })
    return formatBingoData(bingo!, membership?.team ?? null, { userId })
  }

  /** The payload minus the one field that changes on every call. */
  const stable = (board: FormattedBingo) => ({
    ...board,
    battleship: { ...board.battleship!, serverNow: undefined },
  })

  describe("the battleship block", () => {
    it("has empty marks and started=false before the start, even after early completions", async () => {
      // The fixture already completed tile 0 for team A; add a hit and a miss.
      await complete(fx.teamAId, t[2]!)
      await complete(fx.teamAId, t[1]!)
      setClock(fx.clock.beforeStart)

      const { battleship } = await format(fx.memberAId)

      expect(battleship).toMatchObject({
        started: false,
        startDate: fx.startDate,
        marks: { hitTileIds: [], missTileIds: [], sunkTileIds: [] },
        opponentShipsSunk: 0,
        opponentShipsTotal: 2,
        rules: [
          { length: 2, count: 1 },
          { length: 3, count: 1 },
        ],
      })
      expect(battleship!.serverNow.getTime()).toBe(
        fx.clock.beforeStart.getTime()
      )
      expect(
        await getBattleshipBoardStateForTeam(fx.bingoId, fx.teamAId)
      ).toEqual({ hitTileIds: [], missTileIds: [], sunkTileIds: [] })
    })

    it("computes hits and misses of the caller's team from the start on", async () => {
      await complete(fx.teamAId, t[2]!) // B's 3-ship -> hit
      await complete(fx.teamAId, t[1]!) // water -> miss
      // Tile 0 (completed by the fixture) only holds A's own ship -> miss.
      setClock(fx.clock.atStart)

      const { battleship } = await format(fx.memberAId)

      expect(battleship).toMatchObject({
        started: true,
        opponentShipsSunk: 0,
        opponentShipsTotal: 2,
      })
      expect(battleship!.marks.hitTileIds).toEqual([t[2]!])
      expect(sorted(battleship!.marks.missTileIds)).toEqual(
        sorted([t[1]!, t[0]!])
      )
      expect(battleship!.marks.sunkTileIds).toEqual([])
    })

    it("lets sunk win over hit once a whole ship is hit", async () => {
      await complete(fx.teamAId, t[2]!)
      await complete(fx.teamAId, t[3]!)
      await complete(fx.teamAId, t[4]!) // B's 2-ship is complete
      setClock(fx.clock.afterStart)

      const { battleship } = await format(fx.leaderAId)

      expect(battleship!.opponentShipsSunk).toBe(1)
      expect(sorted(battleship!.marks.sunkTileIds)).toEqual(
        sorted([t[3]!, t[4]!])
      )
      const sets = toMarkSets(battleship!.marks)
      expect(markForTile(t[3]!, sets)).toBe("sunk")
      expect(markForTile(t[4]!, sets)).toBe("sunk")
      expect(markForTile(t[2]!, sets)).toBe("hit")
      expect(markForTile(t[1]!, sets)).toBeNull()
    })

    it("keeps the two teams' marks apart", async () => {
      await complete(fx.teamAId, t[2]!)
      await complete(fx.teamBId, t[0]!) // hits A's 3-ship
      setClock(fx.clock.afterStart)

      expect((await format(fx.memberAId)).battleship!.marks.hitTileIds).toEqual(
        [t[2]!]
      )
      expect((await format(fx.memberBId)).battleship!.marks).toEqual({
        hitTileIds: [t[0]!],
        missTileIds: [],
        sunkTileIds: [],
      })
    })

    it("does not change when the opponent moves its ships", async () => {
      // Tiles 0 (the fixture's) and 7 are water in both layouts below.
      await complete(fx.teamAId, t[7]!)
      setClock(fx.clock.afterStart)
      const before = stable(await format(fx.memberAId))

      await db
        .delete(battleshipShips)
        .where(eq(battleshipShips.teamId, fx.teamBId))
      await placeFleet(fx.teamBId, fx.bingoId, [
        { length: 3, tileIds: [t[3]!, t[4]!, t[5]!] },
        { length: 2, tileIds: [t[1]!, t[2]!] },
      ])

      expect(stable(await format(fx.memberAId))).toEqual(before)
    })

    it("carries no opponent ship tile in any payload", async () => {
      // A shot only tile 7 (water). Every tile id is in `tiles`, so look at
      // everything outside it: only A's own shots may be named.
      await complete(fx.teamAId, t[7]!)
      setClock(fx.clock.afterStart)

      const board = await format(fx.memberAId)
      const outsideTiles = JSON.stringify({ ...board, tiles: undefined })

      for (const opponentTile of [t[2]!, t[5]!, t[8]!, t[3]!, t[4]!]) {
        expect(outsideTiles).not.toContain(opponentTile)
      }
      expect(outsideTiles).not.toMatch(/ship[s]?Id|shipTiles|placements/i)
      expect(Object.keys(board.battleship!).sort()).toEqual(
        [
          "marks",
          "opponentShipsSunk",
          "opponentShipsTotal",
          "rules",
          "serverNow",
          "startDate",
          "started",
        ].sort()
      )
    })

    it("gives a participant on no team empty marks", async () => {
      await complete(fx.teamAId, t[2]!)
      setClock(fx.clock.afterStart)

      const { battleship } = await format(fx.outsiderId)

      expect(battleship).toMatchObject({
        started: true,
        marks: { hitTileIds: [], missTileIds: [], sunkTileIds: [] },
        opponentShipsSunk: 0,
        opponentShipsTotal: 2,
      })
    })

    it("gives a manager on no team empty marks and the plain board", async () => {
      await complete(fx.teamAId, t[2]!)
      setClock(fx.clock.afterStart)

      const board = await format(fx.managerId)

      expect(board.battleship!.marks).toEqual({
        hitTileIds: [],
        missTileIds: [],
        sunkTileIds: [],
      })
      expect(board.tiles.some((tile) => tile.isBlind)).toBe(false)
      expectSecret(board, fx.titleOf(0))
    })

    it("is absent on other board types", async () => {
      const standard = await createBlindFixture({ bingoType: "standard" })
      try {
        const bingo = await db.query.bingos.findFirst({
          where: eq(bingos.id, standard.bingoId),
        })
        const board = await formatBingoData(bingo!, null, {
          userId: standard.memberAId,
        })
        expect(board.battleship).toBeUndefined()
        expect(board.tiles.every((tile) => tile.isBlind === false)).toBe(true)
        expectSecret(board, standard.titleOf(0))
      } finally {
        await standard.cleanup()
      }
    })
  })

  describe("blind redaction", () => {
    it("redacts every tile for a team member before the start", async () => {
      setClock(fx.clock.beforeStart)

      const board = await format(fx.memberAId)

      expect(board.tiles).toHaveLength(9)
      for (const tile of board.tiles) {
        expect(tile).toMatchObject({
          isBlind: true,
          title: `Tile ${tile.index + 1}`,
          description: "",
          headerImage: null,
          weight: 0,
          goals: [],
          goalTree: [],
          submission: { status: "not_submitted", submissionCount: 0 },
        })
      }
      // The seeded team submission (image path, status) must not show either.
      expectNoSecrets(board, fx.secrets)
      expectNoSecrets(board, [`/uploads/secret-${fx.tag}`])
    })

    it("redacts for a participant on no team before the start", async () => {
      setClock(fx.clock.beforeStart)

      const board = await format(fx.outsiderId)

      expect(board.tiles.every((tile) => tile.isBlind)).toBe(true)
      expectNoSecrets(board, fx.secrets)
    })

    it("shows managers the unredacted board before the start", async () => {
      setClock(fx.clock.beforeStart)

      const board = await format(fx.managerId)

      expect(board.tiles.every((tile) => !tile.isBlind)).toBe(true)
      expect(board.tiles[0]!.title).toBe(fx.titleOf(0))
      expect(board.battleship).toMatchObject({
        started: false,
        marks: { hitTileIds: [], missTileIds: [], sunkTileIds: [] },
      })
    })

    it.each(["atStart", "afterStart", "afterEnd"] as const)(
      "shows everything %s",
      async (phase) => {
        setClock(fx.clock[phase])

        const board = await format(fx.memberAId)

        expect(board.tiles.every((tile) => !tile.isBlind)).toBe(true)
        expect(board.tiles.map((tile) => tile.title)).toEqual(
          t.map((_, i) => fx.titleOf(i))
        )
      }
    )
  })

  describe("submit gates", () => {
    async function submit(userId: string, index = 2) {
      apiKeyUser.mockResolvedValue(userId)
      const tileId = t[index]!
      const response = await submitTile(
        imageRequest(
          `http://localhost/api/runelite/tiles/${tileId}/submissions`
        ),
        tileParams(tileId)
      )
      return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      }
    }

    async function autoSubmit(userId: string, index = 2, itemId?: number) {
      apiKeyUser.mockResolvedValue(userId)
      const tileId = t[index]!
      const response = await autoSubmitTile(
        imageRequest(
          `http://localhost/api/runelite/tiles/${tileId}/auto-submissions`,
          { itemId: itemId ?? itemIdOf(index), quantity: 1 }
        ),
        tileParams(tileId)
      )
      return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      }
    }

    // Scoped to this fixture's teams: other suites commit submissions to the
    // shared database while this one runs.
    const submissionCount = async () => {
      const [row] = await db
        .select({ value: count() })
        .from(submissions)
        .innerJoin(
          teamTileSubmissions,
          eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
        )
        .where(inArray(teamTileSubmissions.teamId, [fx.teamAId, fx.teamBId]))
      return row!.value
    }

    beforeEach(async () => {
      await giveItemGoals(fx, [1, 2, 3, 4])
      // The manager also plays, in team A.
      await db
        .insert(teamMembers)
        .values({ teamId: fx.teamAId, userId: fx.managerId })
    })

    it.each([
      ["image submission", submit],
      ["auto-submission", autoSubmit],
    ])(
      "answers BOARD_BLIND to a player before the start (%s)",
      async (_l, run) => {
        setClock(fx.clock.beforeStart)
        const before = await submissionCount()

        const { status, body } = await run(fx.memberAId)

        expect(status).toBe(404)
        expect(body).toEqual({ error: "Tile not found", code: "BOARD_BLIND" })
        expect(await submissionCount()).toBe(before)
      }
    )

    it.each([
      ["image submission", submit],
      ["auto-submission", autoSubmit],
    ])(
      "answers EVENT_NOT_STARTED to a manager before the start (%s)",
      async (_l, run) => {
        setClock(fx.clock.beforeStart)
        const before = await submissionCount()

        const { status, body } = await run(fx.managerId)

        expect(status).toBe(403)
        expect(body).toMatchObject({ code: "EVENT_NOT_STARTED" })
        expectNoSecrets(body, fx.secrets)
        expect(await submissionCount()).toBe(before)
        // Nothing was completed, so there is no early mark to leak.
        const completed = await db.query.teamTileSubmissions.findMany({
          where: and(
            eq(teamTileSubmissions.teamId, fx.teamAId),
            eq(teamTileSubmissions.tileId, t[2]!)
          ),
        })
        expect(completed).toEqual([])
      }
    )

    it.each(["atStart", "afterStart", "afterEnd"] as const)(
      "accepts a player %s",
      async (phase) => {
        setClock(fx.clock[phase])
        expect((await submit(fx.memberAId)).status).toBe(200)
        expect((await autoSubmit(fx.memberAId, 1)).status).toBe(200)
      }
    )

    it("accepts the playing manager from the start on", async () => {
      setClock(fx.clock.afterStart)
      expect((await submit(fx.managerId)).status).toBe(200)
    })

    it("does not gate other board types", async () => {
      const standard = await createBlindFixture({ bingoType: "standard" })
      try {
        setClock(standard.clock.beforeStart)
        apiKeyUser.mockResolvedValue(standard.memberAId)
        const tileId = standard.tileIds[2]!
        const response = await submitTile(
          imageRequest(
            `http://localhost/api/runelite/tiles/${tileId}/submissions`
          ),
          tileParams(tileId)
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ shot: null })
      } finally {
        await standard.cleanup()
      }
    })

    describe("the shot result", () => {
      beforeEach(() => {
        setClock(fx.clock.afterStart)
      })

      it("reports hit, miss and sunk for the completing drop", async () => {
        const hit = await autoSubmit(fx.memberAId, 2)
        expect(hit.body.shot).toEqual({ tileId: t[2]!, result: "hit" })
        expect(hit.body.battleship).toMatchObject({
          marks: { hitTileIds: [t[2]!] },
          opponentShipsSunk: 0,
        })

        const miss = await autoSubmit(fx.memberAId, 1)
        expect(miss.body.shot).toEqual({ tileId: t[1]!, result: "miss" })

        const firstOfPair = await autoSubmit(fx.memberAId, 3)
        expect(firstOfPair.body.shot).toEqual({ tileId: t[3]!, result: "hit" })

        const sunk = await autoSubmit(fx.leaderAId, 4)
        expect(sunk.body.shot).toEqual({ tileId: t[4]!, result: "sunk" })
        expect(sunk.body.battleship).toMatchObject({ opponentShipsSunk: 1 })
      })

      it("is null when the drop completed nothing", async () => {
        const { status, body } = await autoSubmit(fx.memberAId, 2, 1)

        expect(status).toBe(200)
        expect(body.matchedGoalId).toBeNull()
        expect(body.shot).toBeNull()
      })

      it("is null for a plain image submission", async () => {
        const { body } = await submit(fx.memberAId, 2)

        expect(body.shot).toBeNull()
        expect(body.tierUnlocked).toBeNull()
      })

      it("is null when the tile was no new mark", async () => {
        // A goal that is not complete yet after the drop.
        await db
          .update(goals)
          .set({ targetValue: 2 })
          .where(eq(goals.tileId, t[2]!))

        const { body } = await autoSubmit(fx.memberAId, 2)

        expect(body.shot).toBeNull()
        expect(
          (body.battleship as FormattedBingo["battleship"])!.marks.hitTileIds
        ).toEqual([])
      })

      it("never names a tile the team did not shoot", async () => {
        const { body } = await autoSubmit(fx.memberAId, 1)

        const json = JSON.stringify(body.shot)
        for (const opponentTile of [t[2]!, t[5]!, t[8]!, t[3]!, t[4]!]) {
          expect(json).not.toContain(opponentTile)
        }
      })
    })
  })

  it("keeps the tile rows untouched by reading", async () => {
    setClock(fx.clock.afterStart)
    await format(fx.memberAId)
    const rows = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, fx.bingoId),
    })
    expect(rows.map((r) => r.title).sort()).toEqual(
      t.map((_, i) => fx.titleOf(i)).sort()
    )
  })
})
