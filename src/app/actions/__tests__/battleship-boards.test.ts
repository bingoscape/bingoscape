/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import {
  addRowOrColumn,
  addTile,
  createBingo,
  deleteRowOrColumn,
  deleteTile,
  reorderTiles,
  updateBingo,
  updateTile,
} from "@/app/actions/bingo"
import { saveTeamShipPlacements } from "@/app/actions/battleship"
import { addUserToTeam, createTeam } from "@/app/actions/team"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  assertTeamLimitForBattleship,
  getBingoShipRules,
} from "@/server/battleship"
import {
  battleshipShips,
  bingos,
  columnBonuses,
  rowBonuses,
  teams,
  tiles,
} from "@/server/db/schema"
import {
  createBattleshipFixture,
  setClock,
  validFleet,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/server/notifications", () => ({
  createNotification: jest.fn(),
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

function boardForm(fx: BattleshipFixture, fields: Record<string, string>) {
  const form = new FormData()
  form.set("eventId", fx.eventId)
  form.set("title", "New board")
  form.set("rows", "3")
  form.set("columns", "3")
  form.set("codephrase", "phrase")
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return form
}

async function findNewBoard(fx: BattleshipFixture) {
  return db.query.bingos.findFirst({
    where: (b, { and: both, eq: equals }) =>
      both(equals(b.eventId, fx.eventId), equals(b.title, "New board")),
  })
}

async function boardSize(bingoId: string) {
  const board = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
  })
  const boardTiles = await db
    .select({ id: tiles.id })
    .from(tiles)
    .where(eq(tiles.bingoId, bingoId))
  return {
    rows: board!.rows,
    columns: board!.columns,
    tiles: boardTiles.length,
  }
}

async function shipCount(bingoId: string) {
  const ships = await db
    .select()
    .from(battleshipShips)
    .where(eq(battleshipShips.bingoId, bingoId))
  return ships.length
}

let fx: BattleshipFixture

beforeEach(async () => {
  jest.clearAllMocks()
  fx = await createBattleshipFixture()
  signInAs(fx.managerId)
})

afterEach(async () => {
  jest.useRealTimers()
  await fx.cleanup()
})

describe("createBingo with the battleship type", () => {
  it("creates the board with the default fleet and no pattern setup", async () => {
    const result = await createBingo(
      boardForm(fx, {
        bingoType: "battleship",
        mainDiagonalBonus: "10",
        completeBoardBonus: "10",
        "rowBonus-0": "5",
        "columnBonus-0": "5",
      })
    )
    expect(result).toEqual({ success: true })

    const board = await findNewBoard(fx)
    expect(board?.bingoType).toBe("battleship")
    expect(board?.mainDiagonalBonusXP).toBe(0)
    expect(board?.completeBoardBonusXP).toBe(0)
    expect(await getBingoShipRules(board!.id)).toEqual([
      { length: 2, count: 1 },
      { length: 3, count: 2 },
    ])
    expect(
      await db
        .select()
        .from(rowBonuses)
        .where(eq(rowBonuses.bingoId, board!.id))
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(columnBonuses)
        .where(eq(columnBonuses.bingoId, board!.id))
    ).toHaveLength(0)
    expect((await boardSize(board!.id)).tiles).toBe(9)
  })

  it("stores a supplied fleet, merging duplicate lengths", async () => {
    const result = await createBingo(
      boardForm(fx, {
        bingoType: "battleship",
        shipRules: JSON.stringify([
          { length: 2, count: 1 },
          { length: 2, count: 2 },
        ]),
      })
    )
    expect(result).toEqual({ success: true })
    const board = await findNewBoard(fx)
    expect(await getBingoShipRules(board!.id)).toEqual([
      { length: 2, count: 3 },
    ])
  })

  it.each([
    [
      "a fleet that does not fit the board",
      JSON.stringify([{ length: 4, count: 1 }]),
    ],
    ["too many ship tiles", JSON.stringify([{ length: 3, count: 4 }])],
    ["malformed JSON", "{not json"],
    ["invalid rules", JSON.stringify([{ length: -1, count: 1 }])],
  ])("rejects %s and creates nothing", async (_label, shipRules) => {
    const result = await createBingo(
      boardForm(fx, { bingoType: "battleship", shipRules })
    )
    expect(result.success).toBe(false)
    expect(await findNewBoard(fx)).toBeUndefined()
  })

  it("rejects an unknown bingo type", async () => {
    const result = await createBingo(boardForm(fx, { bingoType: "bogus" }))
    expect(result).toEqual({ success: false, error: "Invalid bingo type" })
  })

  it("rejects events that already have more than two teams", async () => {
    await db.insert(teams).values({ eventId: fx.eventId, name: "Team C" })
    const result = await createBingo(boardForm(fx, { bingoType: "battleship" }))
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/exactly 2 teams/),
    })
    expect(await findNewBoard(fx)).toBeUndefined()
  })

  it("still creates standard boards for events with more than two teams", async () => {
    await db.insert(teams).values({ eventId: fx.eventId, name: "Team C" })
    const result = await createBingo(boardForm(fx, { bingoType: "standard" }))
    expect(result).toEqual({ success: true })
  })

  it("is manager-only", async () => {
    signInAs(fx.leaderAId)
    const result = await createBingo(boardForm(fx, { bingoType: "battleship" }))
    expect(result.success).toBe(false)
    expect(await findNewBoard(fx)).toBeUndefined()
  })
})

describe("updateBingo and the battleship type", () => {
  const data = (bingoType?: "standard" | "progression" | "battleship") => ({
    title: "Renamed",
    description: "",
    visible: false,
    locked: false,
    codephrase: "phrase",
    bingoType,
  })

  it("rejects changing a battleship board to another type", async () => {
    for (const type of ["standard", "progression"] as const) {
      const result = await updateBingo(fx.bingoId, data(type))
      expect(result).toMatchObject({
        success: false,
        error: "A board cannot be changed to or from the battleship type",
      })
    }
    const board = await db.query.bingos.findFirst({
      where: eq(bingos.id, fx.bingoId),
    })
    expect(board?.bingoType).toBe("battleship")
    expect(board?.title).toBe("Battleship")
  })

  it("rejects changing another board to the battleship type", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.managerId)
      const result = await updateBingo(standard.bingoId, data("battleship"))
      expect(result.success).toBe(false)
      const board = await db.query.bingos.findFirst({
        where: eq(bingos.id, standard.bingoId),
      })
      expect(board?.bingoType).toBe("standard")
      // Other changes, including standard -> progression, keep working.
      expect(await updateBingo(standard.bingoId, data("progression"))).toEqual({
        success: true,
      })
    } finally {
      await standard.cleanup()
    }
  })

  describe("with shipRules", () => {
    const newRules = [
      { length: 2, count: 1 },
      { length: 2, count: 1 },
      { length: 3, count: 1 },
    ]

    it("saves the settings and the rules together and clears every fleet", async () => {
      signInAs(fx.leaderAId)
      await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        validFleet(fx.tileIds)
      )
      signInAs(fx.managerId)

      const result = await updateBingo(fx.bingoId, {
        ...data(undefined),
        shipRules: newRules,
      })
      expect(result).toEqual({ success: true, clearedTeams: 1 })

      expect(await getBingoShipRules(fx.bingoId)).toEqual([
        { length: 2, count: 2 },
        { length: 3, count: 1 },
      ])
      const board = await db.query.bingos.findFirst({
        where: eq(bingos.id, fx.bingoId),
      })
      expect(board?.title).toBe("Renamed")
      expect(await shipCount(fx.bingoId)).toBe(0)
    })

    it("rolls back the other settings when the rules are refused", async () => {
      signInAs(fx.leaderAId)
      await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        validFleet(fx.tileIds)
      )
      signInAs(fx.managerId)

      const result = await updateBingo(fx.bingoId, {
        ...data(undefined),
        shipRules: [{ length: 3, count: 4 }],
      })
      expect(result.success).toBe(false)

      const board = await db.query.bingos.findFirst({
        where: eq(bingos.id, fx.bingoId),
      })
      expect(board?.title).toBe("Battleship")
      expect(await getBingoShipRules(fx.bingoId)).toEqual([
        { length: 2, count: 1 },
        { length: 3, count: 1 },
      ])
      expect(await shipCount(fx.bingoId)).toBe(2)
    })

    it("refuses new rules once the event started, and keeps the other settings", async () => {
      setClock(new Date(fx.startDate.getTime()))
      const result = await updateBingo(fx.bingoId, {
        ...data(undefined),
        shipRules: newRules,
      })
      expect(result.success).toBe(false)
      expect(result).toMatchObject({
        error: expect.stringMatching(/before the event starts/),
      })
      const board = await db.query.bingos.findFirst({
        where: eq(bingos.id, fx.bingoId),
      })
      expect(board?.title).toBe("Battleship")
    })

    it("rejects malformed rules and rules for another board type", async () => {
      expect(
        await updateBingo(fx.bingoId, {
          ...data(undefined),
          shipRules: [{ length: 0, count: 1 }],
        })
      ).toEqual({ success: false, error: "Invalid ship rules" })

      const standard = await createBattleshipFixture({ bingoType: "standard" })
      try {
        signInAs(standard.managerId)
        const result = await updateBingo(standard.bingoId, {
          ...data(undefined),
          shipRules: newRules,
        })
        expect(result).toMatchObject({
          success: false,
          error: "Not a battleship board",
        })
      } finally {
        await standard.cleanup()
      }
    })

    it("is manager-only", async () => {
      signInAs(fx.leaderAId)
      const result = await updateBingo(fx.bingoId, {
        ...data(undefined),
        shipRules: newRules,
      })
      expect(result.success).toBe(false)
    })
  })

  it("allows editing a battleship board without changing its type", async () => {
    expect(await updateBingo(fx.bingoId, data("battleship"))).toEqual({
      success: true,
    })
    expect(await updateBingo(fx.bingoId, data(undefined))).toEqual({
      success: true,
    })
  })
})

describe("two-team rule", () => {
  it("blocks creating a third team in an event with a battleship board", async () => {
    const result = await createTeam(fx.eventId, "Team C")
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/exactly 2 teams/),
    })
    const all = await db
      .select()
      .from(teams)
      .where(eq(teams.eventId, fx.eventId))
    expect(all).toHaveLength(2)
  })

  it("allows team creation in events without a battleship board", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.managerId)
      expect((await createTeam(standard.eventId, "Team C")).success).toBe(true)
    } finally {
      await standard.cleanup()
    }
  })

  it("allows re-creating a team after one was deleted, but never a third", async () => {
    await db.delete(teams).where(eq(teams.id, fx.teamBId))
    expect((await createTeam(fx.eventId, "Team B2")).success).toBe(true)
    expect((await createTeam(fx.eventId, "Team C")).success).toBe(false)
  })

  it("lets only one of two concurrent team creations through", async () => {
    await db.delete(teams).where(eq(teams.id, fx.teamBId))
    const results = await Promise.all([
      createTeam(fx.eventId, "Team X"),
      createTeam(fx.eventId, "Team Y"),
    ])
    expect(results.filter((r) => r.success)).toHaveLength(1)
    const all = await db
      .select()
      .from(teams)
      .where(eq(teams.eventId, fx.eventId))
    expect(all).toHaveLength(2)
  })

  it("accounts for several teams created at once (balanced team generation)", async () => {
    await db.delete(teams).where(eq(teams.id, fx.teamBId))
    await expect(
      db.transaction((tx) => assertTeamLimitForBattleship(tx, fx.eventId, 2))
    ).rejects.toThrow(/exactly 2 teams/)
    await expect(
      db.transaction((tx) => assertTeamLimitForBattleship(tx, fx.eventId, 1))
    ).resolves.toBeUndefined()
  })

  it("still lets members be assigned to the two existing teams", async () => {
    expect((await addUserToTeam(fx.teamAId, fx.outsiderId)).success).toBe(true)
  })
})

describe("structural edits on battleship boards", () => {
  const LAYOUT_ERROR = /layout|Ships are already placed/

  async function placeShips() {
    signInAs(fx.leaderAId)
    expect(
      await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        validFleet(fx.tileIds)
      )
    ).toEqual({ success: true })
    signInAs(fx.managerId)
  }

  async function expectLayoutLocked() {
    const before = await boardSize(fx.bingoId)
    const results = [
      await deleteTile(fx.tileIds[8]!, fx.bingoId),
      await addTile(fx.bingoId),
      await addRowOrColumn(fx.bingoId, "row"),
      await addRowOrColumn(fx.bingoId, "column"),
      await deleteRowOrColumn(fx.bingoId, "row"),
      await deleteRowOrColumn(fx.bingoId, "column"),
      await reorderTiles([
        { id: fx.tileIds[0]!, index: 1 },
        { id: fx.tileIds[1]!, index: 0 },
      ]),
      await updateTile(fx.tileIds[0]!, { index: 8 }),
    ]
    for (const result of results) {
      expect(result.success).toBe(false)
      expect((result as { error?: string }).error).toMatch(LAYOUT_ERROR)
    }
    expect(await boardSize(fx.bingoId)).toEqual(before)
    const first = await db.query.tiles.findFirst({
      where: eq(tiles.id, fx.tileIds[0]!),
    })
    expect(first?.index).toBe(0)
  }

  it("blocks every layout change while ships are placed", async () => {
    await placeShips()
    await expectLayoutLocked()
  })

  it("blocks every layout change after the event started, even without ships", async () => {
    setClock(new Date(fx.startDate.getTime() + 1000))
    await expectLayoutLocked()
  })

  it("allows layout changes before the start while no ship is placed", async () => {
    expect((await addRowOrColumn(fx.bingoId, "row")).success).toBe(true)
    expect((await deleteRowOrColumn(fx.bingoId, "row")).success).toBe(true)
    expect((await boardSize(fx.bingoId)).rows).toBe(3)
  })

  it("allows layout changes again after the fleets were cleared", async () => {
    await placeShips()
    signInAs(fx.leaderAId)
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [])
    signInAs(fx.managerId)
    expect((await addRowOrColumn(fx.bingoId, "column")).success).toBe(true)
  })

  it("refuses to hide a tile that carries a ship, but hides other tiles", async () => {
    await placeShips()
    const shipTile = await updateTile(fx.tileIds[4]!, { isHidden: true })
    expect(shipTile.success).toBe(false)
    expect((shipTile as { error?: string }).error).toMatch(/ship/)
    const stillVisible = await db.query.tiles.findFirst({
      where: eq(tiles.id, fx.tileIds[4]!),
    })
    expect(stillVisible?.isHidden).toBe(false)

    expect((await updateTile(fx.tileIds[1]!, { isHidden: true })).success).toBe(
      true
    )
  })

  it("keeps ordinary tile edits working", async () => {
    await placeShips()
    expect(
      (await updateTile(fx.tileIds[4]!, { title: "Renamed", index: 4 })).success
    ).toBe(true)
    expect(
      (await updateTile(fx.tileIds[4]!, { isHidden: false })).success
    ).toBe(true)
  })

  it("does not affect standard boards", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.managerId)
      expect((await addRowOrColumn(standard.bingoId, "row")).success).toBe(true)
      expect(
        (await deleteTile(standard.tileIds[8]!, standard.bingoId)).success
      ).toBe(true)
    } finally {
      await standard.cleanup()
    }
  })

  it("deleteTile only deletes tiles of the board the caller manages", async () => {
    const other = await createBattleshipFixture({ bingoType: "standard" })
    try {
      // The manager of fx may not delete a tile of another event's board
      // by passing their own bingoId.
      await deleteTile(other.tileIds[0]!, fx.bingoId)
      const stillThere = await db.query.tiles.findFirst({
        where: eq(tiles.id, other.tileIds[0]!),
      })
      expect(stillThere).toBeDefined()
    } finally {
      await other.cleanup()
    }
  })
})
