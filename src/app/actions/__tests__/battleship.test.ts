import { beforeEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@/server/auth", () => ({
  getServerAuthSession: jest.fn(),
}))

jest.mock("@/app/actions/events", () => ({
  getUserRole: jest.fn(),
}))

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}))

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}))

const mockInsertValues = jest.fn()
const mockInsertReturning = jest.fn()
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined)

function mockInsertChain() {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: "tts-1" }]),
    }),
  }
}

const mockTx = {
  query: {
    battleshipShips: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
  delete: jest.fn().mockReturnValue({ where: mockDeleteWhere }),
  insert: jest.fn().mockImplementation(() => ({
    values: mockInsertValues.mockImplementation(() => ({
      returning: mockInsertReturning,
    })),
  })),
}

jest.mock("@/server/db", () => ({
  db: {
    query: {
      events: { findFirst: jest.fn() },
      bingos: { findFirst: jest.fn() },
      battleshipShips: { findMany: jest.fn(), findFirst: jest.fn() },
      battleshipHits: { findMany: jest.fn() },
      teamMembers: { findFirst: jest.fn() },
      teams: { findFirst: jest.fn() },
      bingoShipRules: { findFirst: jest.fn() },
    },
    insert: jest.fn(() => mockInsertChain()),
    transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx)
    ),
    select: jest.fn(),
  },
}))

describe("battleship actions", () => {
  const { getServerAuthSession } = jest.requireMock("@/server/auth") as {
    getServerAuthSession: jest.Mock
  }
  const { getUserRole } = jest.requireMock("@/app/actions/events") as {
    getUserRole: jest.Mock
  }
  const { db } = jest.requireMock("@/server/db") as {
    db: {
      query: Record<string, { findFirst: jest.Mock; findMany: jest.Mock }>
      insert: jest.Mock
      transaction: jest.Mock
      select: jest.Mock
    }
  }

  const battleshipBingo = {
    id: "bingo-1",
    eventId: "event-1",
    columns: 5,
    bingoType: "battleship" as const,
    tiles: [
      { id: "tile-a", index: 0, isHidden: false },
      { id: "tile-b", index: 1, isHidden: false },
      { id: "tile-c", index: 2, isHidden: false },
      { id: "tile-d", index: 5, isHidden: false },
      { id: "tile-e", index: 6, isHidden: false },
    ],
    shipRules: { rulesJson: [{ length: 3, count: 1 }, { length: 2, count: 1 }] },
  }
  const futureEvent = {
    creatorId: "owner-1",
    startDate: new Date("2100-01-01T00:00:00.000Z"),
    endDate: new Date("2100-01-02T00:00:00.000Z"),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getServerAuthSession.mockResolvedValue({ user: { id: "user-1" } })
    getUserRole.mockResolvedValue("participant")
    db.query.events.findFirst.mockResolvedValue(futureEvent)
    mockInsertValues.mockReset()
    mockInsertReturning.mockReset()
    mockDeleteWhere.mockReset()
    mockTx.query.battleshipShips.findMany.mockResolvedValue([])
    db.query.teams.findFirst.mockResolvedValue({ id: "team-1" })
  })

  describe("parseShipRulesFromFormData", () => {
    const { parseShipRulesFromFormData } = require("../battleship")

    it("parses ship rule fields from form data", async () => {
      const formData = new FormData()
      formData.append("shipRuleLength-0", "3")
      formData.append("shipRuleCount-0", "2")
      formData.append("shipRuleLength-1", "2")
      formData.append("shipRuleCount-1", "1")
      formData.append("shipRuleLength-2", "0")
      formData.append("shipRuleCount-2", "5")

      await expect(parseShipRulesFromFormData(formData)).resolves.toEqual([
        { length: 2, count: 1 },
        { length: 3, count: 2 },
      ])
    })

    it("merges duplicate-length rules from form data", async () => {
      const formData = new FormData()
      formData.append("shipRuleLength-0", "3")
      formData.append("shipRuleCount-0", "2")
      formData.append("shipRuleLength-1", "3")
      formData.append("shipRuleCount-1", "1")

      await expect(parseShipRulesFromFormData(formData)).resolves.toEqual([
        { length: 3, count: 3 },
      ])
    })
  })

  describe("getBingoShipRules", () => {
    const { getBingoShipRules } = require("../battleship")

    it("returns empty array when no rules exist", async () => {
      db.query.bingoShipRules.findFirst.mockResolvedValue(undefined)
      await expect(getBingoShipRules("bingo-1")).resolves.toEqual([])
    })

    it("returns stored ship rules", async () => {
      db.query.bingoShipRules.findFirst.mockResolvedValue({
        rulesJson: [{ length: 3, count: 2 }],
      })
      await expect(getBingoShipRules("bingo-1")).resolves.toEqual([
        { length: 3, count: 2 },
      ])
    })

    it("merges duplicate-length rules from storage", async () => {
      db.query.bingoShipRules.findFirst.mockResolvedValue({
        rulesJson: [
          { length: 3, count: 2 },
          { length: 3, count: 1 },
        ],
      })
      await expect(getBingoShipRules("bingo-1")).resolves.toEqual([
        { length: 3, count: 3 },
      ])
    })
  })

  describe("getTeamShipPlacements", () => {
    const { getTeamShipPlacements } = require("../battleship")

    it("requires authentication", async () => {
      getServerAuthSession.mockResolvedValue(null)
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      const result = await getTeamShipPlacements("bingo-1", "team-1")
      expect(result).toEqual({ success: false, error: "Not authenticated" })
    })

    it("rejects non-battleship boards", async () => {
      db.query.bingos.findFirst.mockResolvedValue({
        ...battleshipBingo,
        bingoType: "standard",
      })
      const result = await getTeamShipPlacements("bingo-1", "team-1")
      expect(result).toEqual({ success: false, error: "Not a battleship board" })
    })

    it("returns team ship placements", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })
      db.query.battleshipShips.findMany.mockResolvedValue([
        {
          shipLength: 3,
          tiles: [{ tileId: "tile-a" }, { tileId: "tile-b" }, { tileId: "tile-c" }],
        },
      ])

      const result = await getTeamShipPlacements("bingo-1", "team-1")
      expect(result.success).toBe(true)
      expect(result.ships).toEqual([
        { length: 3, tileIds: ["tile-a", "tile-b", "tile-c"] },
      ])
    })

    it("rejects teams that do not belong to the event", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teams.findFirst.mockResolvedValue(undefined)

      const result = await getTeamShipPlacements("bingo-1", "team-other")
      expect(result).toEqual({
        success: false,
        error: "Team not found in this event",
      })
    })
  })

  describe("saveTeamShipPlacements", () => {
    const { saveTeamShipPlacements } = require("../battleship")

    const validPlacements = [
      { length: 3, tileIds: ["tile-a", "tile-b", "tile-c"] },
      { length: 2, tileIds: ["tile-d", "tile-e"] },
    ]

    it("validates placements before saving", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })

      const result = await saveTeamShipPlacements("bingo-1", "team-1", [
        { length: 3, tileIds: ["tile-a", "tile-b", "tile-c"] },
      ])
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/^Expected \d+ ships of length/)
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("persists valid placements in a transaction", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })
      mockInsertReturning.mockResolvedValue([{ id: "ship-1" }, { id: "ship-2" }])

      const result = await saveTeamShipPlacements(
        "bingo-1",
        "team-1",
        validPlacements
      )

      expect(result).toEqual({ success: true })
      expect(db.transaction).toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalled()
    })

    it("rejects placement when event is active or completed", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })
      db.query.events.findFirst.mockResolvedValue({
        creatorId: "owner-1",
        startDate: new Date("2000-01-01T00:00:00.000Z"),
        endDate: new Date("2100-01-01T00:00:00.000Z"),
      })

      const result = await saveTeamShipPlacements(
        "bingo-1",
        "team-1",
        validPlacements
      )

      expect(result).toEqual({
        success: false,
        error: "Ship placement is only allowed before the event starts",
      })
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("rejects non-leaders that are not board creator or event admin", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      getUserRole.mockResolvedValue("participant")
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: false })

      const result = await saveTeamShipPlacements(
        "bingo-1",
        "team-1",
        validPlacements
      )

      expect(result).toEqual({
        success: false,
        error:
          "Only team leaders, event admins, or board creator can manage ship placement",
      })
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("allows event management role without team leadership", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      getUserRole.mockResolvedValue("management")
      db.query.teamMembers.findFirst.mockResolvedValue(undefined)
      mockInsertReturning.mockResolvedValue([{ id: "ship-1" }, { id: "ship-2" }])

      const result = await saveTeamShipPlacements(
        "bingo-1",
        "team-1",
        validPlacements
      )

      expect(result).toEqual({ success: true })
      expect(db.transaction).toHaveBeenCalled()
    })

    it("clears saved placements when given an empty array", async () => {
      db.query.bingos.findFirst.mockResolvedValue(battleshipBingo)
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })

      const result = await saveTeamShipPlacements("bingo-1", "team-1", [])

      expect(result).toEqual({ success: true })
      expect(db.transaction).toHaveBeenCalled()
    })

    it("rejects placements on hidden tiles", async () => {
      db.query.bingos.findFirst.mockResolvedValue({
        ...battleshipBingo,
        tiles: [
          { id: "tile-a", index: 0, isHidden: true },
          { id: "tile-b", index: 1, isHidden: false },
          { id: "tile-c", index: 2, isHidden: false },
          { id: "tile-d", index: 5, isHidden: false },
          { id: "tile-e", index: 6, isHidden: false },
        ],
      })
      db.query.teamMembers.findFirst.mockResolvedValue({ isLeader: true })

      const result = await saveTeamShipPlacements("bingo-1", "team-1", [
        { length: 3, tileIds: ["tile-a", "tile-b", "tile-c"] },
        { length: 2, tileIds: ["tile-d", "tile-e"] },
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe("Cannot place ships on hidden tiles")
    })
  })

  describe("getBattleshipHits", () => {
    const { getBattleshipHits } = require("../battleship")

    it("maps hit records for the board", async () => {
      db.query.battleshipHits.findMany.mockResolvedValue([
        {
          tileId: "tile-a",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
      ])

      await expect(getBattleshipHits("bingo-1")).resolves.toEqual([
        {
          tileId: "tile-a",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
      ])
    })
  })

  describe("recordBattleshipHitOnApproval", () => {
    const { recordBattleshipHitOnApproval } = require("../battleship")

    const selectChain = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    }

    beforeEach(() => {
      db.select.mockReturnValue(selectChain)
    })

    it("returns hit false when tile is not on opponent ship", async () => {
      selectChain.limit.mockResolvedValue([])

      const result = await recordBattleshipHitOnApproval(
        "bingo-1",
        "tile-a",
        "team-atk",
        "tts-1"
      )
      expect(result).toEqual({ hit: false })
    })

    it("records a hit when tile is on opponent ship", async () => {
      selectChain.limit.mockResolvedValue([
        {
          shipId: "ship-1",
          defenderTeamId: "team-def",
          shipLength: 3,
        },
      ])
      db.insert.mockImplementation(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      }))
      db.query.battleshipShips.findFirst.mockResolvedValue({
        id: "ship-1",
        teamId: "team-def",
        tiles: [{ tileId: "tile-a" }, { tileId: "tile-b" }],
      })
      db.query.battleshipShips.findMany.mockResolvedValue([
        {
          id: "ship-1",
          teamId: "team-def",
          tiles: [{ tileId: "tile-a" }, { tileId: "tile-b" }],
        },
      ])
      db.query.battleshipHits.findMany.mockResolvedValue([
        {
          tileId: "tile-a",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
      ])

      const result = await recordBattleshipHitOnApproval(
        "bingo-1",
        "tile-a",
        "team-atk",
        "tts-1"
      )
      expect(result).toEqual({
        hit: true,
        defenderTeamId: "team-def",
        shipSunk: false,
        shipLength: undefined,
      })
    })

    it("reports when the hit sinks the opponent ship", async () => {
      selectChain.limit.mockResolvedValue([
        {
          shipId: "ship-1",
          defenderTeamId: "team-def",
          shipLength: 2,
        },
      ])
      db.insert.mockImplementation(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      }))
      db.query.battleshipShips.findFirst.mockResolvedValue({
        id: "ship-1",
        teamId: "team-def",
        tiles: [{ tileId: "tile-a" }, { tileId: "tile-b" }],
      })
      db.query.battleshipShips.findMany.mockResolvedValue([
        {
          id: "ship-1",
          teamId: "team-def",
          tiles: [{ tileId: "tile-a" }, { tileId: "tile-b" }],
        },
      ])
      db.query.battleshipHits.findMany.mockResolvedValue([
        {
          tileId: "tile-a",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
        {
          tileId: "tile-b",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
      ])

      const result = await recordBattleshipHitOnApproval(
        "bingo-1",
        "tile-b",
        "team-atk",
        "tts-1"
      )
      expect(result).toEqual({
        hit: true,
        defenderTeamId: "team-def",
        shipSunk: true,
        shipLength: 2,
      })
    })

    it("treats duplicate hits as success", async () => {
      selectChain.limit.mockResolvedValue([
        {
          shipId: "ship-1",
          defenderTeamId: "team-def",
          shipLength: 3,
        },
      ])
      db.insert.mockImplementation(() => ({
        values: jest.fn().mockRejectedValue(new Error("unique violation")),
      }))
      db.query.battleshipShips.findFirst.mockResolvedValue({
        id: "ship-1",
        teamId: "team-def",
        tiles: [{ tileId: "tile-a" }],
      })
      db.query.battleshipShips.findMany.mockResolvedValue([
        {
          id: "ship-1",
          teamId: "team-def",
          tiles: [{ tileId: "tile-a" }],
        },
      ])
      db.query.battleshipHits.findMany.mockResolvedValue([
        {
          tileId: "tile-a",
          attackerTeamId: "team-atk",
          defenderTeamId: "team-def",
        },
      ])

      const result = await recordBattleshipHitOnApproval(
        "bingo-1",
        "tile-a",
        "team-atk",
        "tts-1"
      )
      expect(result.hit).toBe(true)
      expect(result.defenderTeamId).toBe("team-def")
      expect(result.shipSunk).toBe(true)
    })
  })
})
