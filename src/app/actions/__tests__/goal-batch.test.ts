/**
 * @jest-environment node
 */
import { inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getEventRole } from "@/server/authz/actor"
import {
  applyGoalsToTiles,
  type GoalBatchSource,
} from "@/app/actions/goal-batch"
import type { NewGoalInput } from "@/server/goal-create"
import { logger } from "@/lib/logger"
import {
  goalGroups,
  goals,
  itemGoals,
  metricGoals,
  tiles,
} from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
// The role lookup is the seam: `getUserRole` delegates to the actor loader.
jest.mock("@/server/authz/actor", () => ({ getEventRole: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
// The tile lookup is a database filter; the test reads the ids it was asked for.
jest.mock("drizzle-orm", () => {
  const actual = jest.requireActual("drizzle-orm")
  return {
    ...actual,
    inArray: jest.fn((...args: unknown[]) => actual.inArray(...args)),
  }
})
jest.mock("@/server/db", () => {
  const tx = {
    insert: jest.fn(),
    select: jest.fn(),
    query: {
      goals: { findMany: jest.fn() },
      goalGroups: { findMany: jest.fn() },
    },
  }
  return {
    db: {
      query: { bingos: { findFirst: jest.fn() } },
      transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      __tx: tx,
    },
  }
})

const session = getServerAuthSession as jest.Mock
const role = getEventRole as jest.Mock
const inArrayMock = inArray as unknown as jest.Mock
const mockDb = db as unknown as {
  query: { bingos: { findFirst: jest.Mock } }
  transaction: jest.Mock
  __tx: {
    insert: jest.Mock
    select: jest.Mock
    query: {
      goals: { findMany: jest.Mock }
      goalGroups: { findMany: jest.Mock }
    }
  }
}
const tx = mockDb.__tx

const BINGO = "bingo-1"

interface Inserted {
  table: unknown
  row: Record<string, unknown>
  id: string
}

/** Rows passed to tx.insert(table).values(row), in call order. */
let inserted: Inserted[]
let nextId: number
/** Tile ids that belong to the board; the lookup only finds these. */
let boardTiles: Set<string>
/** What `max(order_index)` returns, one entry per selected tile, in order. */
let goalMax: (number | null)[]
let groupMax: (number | null)[]

const NOW = new Date("2026-01-01T00:00:00Z")

const item = (name: string, targetValue = 1): NewGoalInput => ({
  type: "item",
  itemId: 4151,
  itemName: name,
  baseName: name,
  imageUrl: "https://example.com/item.png",
  targetValue,
})

const task = (description = "Do the thing", targetValue = 1): NewGoalInput => ({
  type: "generic",
  description,
  targetValue,
})

const newGoals = (...inputs: NewGoalInput[]): GoalBatchSource => ({
  kind: "goals",
  goals: inputs,
})

const copyOf = (sourceTileId: string): GoalBatchSource => ({
  kind: "copy",
  sourceTileId,
})

/** A stored group of the copy source, with the columns a real row has. */
const srcGroup = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  tileId: "src",
  parentGroupId: null,
  name: null,
  logicalOperator: "AND",
  minRequiredGoals: 1,
  orderIndex: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
})

/** A stored goal of the copy source, with progress data that must not be copied. */
const srcGoal = (over: Record<string, unknown> = {}) => ({
  id: "a",
  tileId: "src",
  parentGroupId: null,
  description: "Do the thing",
  targetValue: 1,
  goalType: "generic",
  orderIndex: 0,
  createdAt: NOW,
  updatedAt: NOW,
  itemGoal: null,
  metricGoal: null,
  teamProgress: [{ teamId: "team-1", currentValue: 7 }],
  goalValues: [{ id: "v1", value: 3 }],
  ...over,
})

const srcItemDetails = (name: string) => ({
  id: `${name}-item`,
  goalId: "x",
  itemId: 4151,
  baseName: name,
  exactVariant: null,
  imageUrl: "https://example.com/item.png",
  createdAt: NOW,
  updatedAt: NOW,
})

/** The goal tree used by the copy tests: two nested groups, four goals. */
function mockSourceTree() {
  tx.query.goalGroups.findMany.mockResolvedValue([
    srcGroup({
      id: "g1",
      name: "Drops",
      logicalOperator: "AND",
      orderIndex: 0,
    }),
    srcGroup({
      id: "g2",
      parentGroupId: "g1",
      logicalOperator: "OR",
      minRequiredGoals: 2,
      orderIndex: 0,
    }),
  ])
  tx.query.goals.findMany.mockResolvedValue([
    srcGoal({
      id: "a",
      parentGroupId: "g2",
      description: "Abyssal whip",
      goalType: "item",
      itemGoal: srcItemDetails("Abyssal whip"),
    }),
    srcGoal({
      id: "b",
      parentGroupId: "g2",
      description: "Dragon warhammer",
      targetValue: 2,
      goalType: "item",
      orderIndex: 1,
      itemGoal: srcItemDetails("Dragon warhammer"),
    }),
    srcGoal({
      id: "c",
      parentGroupId: "g1",
      description: "Do a raid",
      targetValue: 5,
      orderIndex: 1,
    }),
    srcGoal({
      id: "d",
      description: "Zulrah",
      targetValue: 50,
      goalType: "metric",
      orderIndex: 1,
      metricGoal: { metricType: "boss", metricName: "zulrah" },
    }),
  ])
}

beforeEach(() => {
  jest.clearAllMocks()
  inserted = []
  nextId = 1
  boardTiles = new Set(["t1", "t2", "t3", "src"])
  goalMax = []
  groupMax = []
  session.mockResolvedValue({ user: { id: "user-1" } })
  role.mockResolvedValue("admin")
  mockDb.query.bingos.findFirst.mockResolvedValue({ eventId: "event-1" })
  tx.query.goalGroups.findMany.mockResolvedValue([])
  tx.query.goals.findMany.mockResolvedValue([])

  tx.insert.mockImplementation((table: unknown) => ({
    values: (row: Record<string, unknown>) => ({
      returning: async () => {
        const id = `id-${nextId++}`
        inserted.push({ table, row, id })
        return [{ ...row, id }]
      },
    }),
  }))
  tx.select.mockImplementation(() => ({
    from: (table: unknown) => ({
      where: async () => {
        if (table === tiles) {
          const asked = inArrayMock.mock.calls.at(-1)?.[1] as string[]
          return asked.filter((id) => boardTiles.has(id)).map((id) => ({ id }))
        }
        const queue = table === goals ? goalMax : groupMax
        return [{ value: queue.shift() ?? null }]
      },
    }),
  }))
})

const entriesFor = (table: unknown) => inserted.filter((i) => i.table === table)
const rowsFor = (table: unknown) => entriesFor(table).map((i) => i.row)

describe("applyGoalsToTiles: new goals", () => {
  it("appends the goals to every selected tile in one transaction", async () => {
    goalMax = [3, null, 0]
    groupMax = [1, null, null]

    const result = await applyGoalsToTiles(
      BINGO,
      ["t1", "t2", "t3"],
      newGoals(item("Abyssal whip"), task("Kill a boss", 3))
    )

    expect(result).toEqual({
      success: true,
      tilesUpdated: 3,
      goalsCreated: 6,
      groupsCreated: 0,
    })
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)

    const goalRows = rowsFor(goals)
    expect(goalRows.map((r) => r.tileId)).toEqual([
      "t1",
      "t1",
      "t2",
      "t2",
      "t3",
      "t3",
    ])
    // After the existing goals/groups of each tile (t1: 3 and 1, t2: none, t3: 0).
    expect(goalRows.map((r) => r.orderIndex)).toEqual([4, 5, 0, 1, 1, 2])
    expect(goalRows.every((r) => r.parentGroupId === null)).toBe(true)
    expect(goalRows[0]).toMatchObject({
      goalType: "item",
      description: "Abyssal whip",
      targetValue: 1,
    })
    expect(goalRows[1]).toMatchObject({
      goalType: "generic",
      description: "Kill a boss",
      targetValue: 3,
    })
    expect(rowsFor(itemGoals)).toHaveLength(3)
    expect(rowsFor(goalGroups)).toHaveLength(0)
  })

  it("creates item and metric details with the goals", async () => {
    await applyGoalsToTiles(
      BINGO,
      ["t1"],
      newGoals(item("Abyssal whip", 2), {
        type: "metric",
        metricType: "boss",
        metricName: "abyssal_sire",
        targetValue: 50,
      })
    )

    expect(rowsFor(itemGoals)[0]).toMatchObject({
      itemId: 4151,
      baseName: "Abyssal whip",
    })
    expect(rowsFor(metricGoals)[0]).toMatchObject({
      metricType: "boss",
      metricName: "abyssal_sire",
    })
    expect(rowsFor(goals)[1]).toMatchObject({ description: "Abyssal Sire" })
  })

  it("treats a tile that is listed twice as one tile", async () => {
    const result = await applyGoalsToTiles(
      BINGO,
      ["t1", "t1", "t2"],
      newGoals(task())
    )

    expect(result).toMatchObject({ success: true, tilesUpdated: 2 })
    expect(rowsFor(goals).map((r) => r.tileId)).toEqual(["t1", "t2"])
  })

  it("asks the database for exactly the selected tiles", async () => {
    await applyGoalsToTiles(BINGO, ["t1", "t2"], newGoals(task()))
    expect(inArrayMock).toHaveBeenCalledWith(tiles.id, ["t1", "t2"])
  })

  it("revalidates the event pages after success", async () => {
    await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
    expect(revalidatePath).toHaveBeenCalledWith("/events/[id]", "layout")
  })

  describe("tiles that are not on the board", () => {
    it("rejects the whole request when one tile is from another board", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        ["t1", "other-board-tile"],
        newGoals(task())
      )

      expect(result).toEqual({
        success: false,
        error: "Some of the selected tiles are not on this board",
      })
      expect(inserted).toHaveLength(0)
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it("rejects an unknown tile id", async () => {
      const result = await applyGoalsToTiles(BINGO, ["nope"], newGoals(task()))
      expect(result.success).toBe(false)
      expect(inserted).toHaveLength(0)
    })
  })

  describe("who may apply goals", () => {
    it.each([["participant"], [null]])(
      "rejects a caller with role %s without writing",
      async (r) => {
        role.mockResolvedValue(r)
        const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
        expect(result.success).toBe(false)
        expect(mockDb.transaction).not.toHaveBeenCalled()
        expect(inserted).toHaveLength(0)
      }
    )

    it("accepts a management member", async () => {
      role.mockResolvedValue("management")
      const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
      expect(result.success).toBe(true)
    })

    it("rejects a caller who is not signed in", async () => {
      session.mockResolvedValue(null)
      const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
      expect(result).toEqual({ success: false, error: "Unauthorized" })
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects a board that does not exist", async () => {
      mockDb.query.bingos.findFirst.mockResolvedValue(undefined)
      const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
      expect(result).toEqual({ success: false, error: "Bingo not found" })
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("checks the board, never an event id from the client", async () => {
      await applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
      expect(role).toHaveBeenCalledWith("event-1")
    })
  })

  describe("limits", () => {
    it("rejects more than 100 tiles", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `tile-${i}`)
      const result = await applyGoalsToTiles(BINGO, ids, newGoals(task()))
      expect(result).toEqual({
        success: false,
        error: "You can change at most 100 tiles at once",
      })
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("accepts exactly 100 tiles", async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `tile-${i}`)
      boardTiles = new Set(ids)
      const result = await applyGoalsToTiles(BINGO, ids, newGoals(task()))
      expect(result).toMatchObject({ success: true, tilesUpdated: 100 })
    })

    it("rejects more than 100 new goals per tile", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        ["t1"],
        newGoals(...Array.from({ length: 101 }, () => task()))
      )
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects more than 500 new goals in total", async () => {
      const ids = Array.from({ length: 60 }, (_, i) => `tile-${i}`)
      boardTiles = new Set(ids)
      const result = await applyGoalsToTiles(
        BINGO,
        ids,
        newGoals(...Array.from({ length: 9 }, () => task()))
      )
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/limit is 500/)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("accepts exactly 500 goals in total", async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `tile-${i}`)
      boardTiles = new Set(ids)
      const result = await applyGoalsToTiles(
        BINGO,
        ids,
        newGoals(...Array.from({ length: 5 }, () => task()))
      )
      expect(result).toMatchObject({ success: true, goalsCreated: 500 })
    })
  })

  describe("validation (nothing is written)", () => {
    it.each([
      ["zero target", task("x", 0)],
      ["fractional target", task("x", 1.5)],
      ["NaN target", task("x", Number.NaN)],
      ["oversized target", task("x", 2_147_483_648)],
      ["blank description", task("   ")],
    ])("rejects %s", async (_label, input) => {
      const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals(input))
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("names the offending goal", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        ["t1"],
        newGoals(task(), task("x", 0))
      )
      expect(result).toEqual({
        success: false,
        error: "Goal 2: Target value must be greater than 0",
      })
    })

    it("rejects a metric goal without a metric", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        ["t1"],
        newGoals({
          type: "metric",
          metricType: "",
          metricName: "",
          targetValue: 1,
        })
      )
      expect(result.success).toBe(false)
    })

    it("rejects an empty list of goals", async () => {
      const result = await applyGoalsToTiles(BINGO, ["t1"], newGoals())
      expect(result).toEqual({ success: false, error: "No goals to create" })
    })

    it("rejects an empty selection", async () => {
      const result = await applyGoalsToTiles(BINGO, [], newGoals(task()))
      expect(result).toEqual({
        success: false,
        error: "Select at least one tile",
      })
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects tile ids that are not strings", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        [42 as unknown as string],
        newGoals(task())
      )
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects a request without a source", async () => {
      const result = await applyGoalsToTiles(
        BINGO,
        ["t1"],
        undefined as unknown as GoalBatchSource
      )
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })

  describe("all or nothing", () => {
    it("reports a failure instead of throwing when an insert fails part way", async () => {
      // The first tile's goal and detail rows go through, the second tile fails.
      let calls = 0
      const original = tx.insert.getMockImplementation()!
      tx.insert.mockImplementation((table: unknown) => {
        calls++
        if (calls > 2) throw new Error("boom")
        return original(table)
      })

      const result = await applyGoalsToTiles(
        BINGO,
        ["t1", "t2"],
        newGoals(item("Abyssal whip"))
      )

      expect(result).toEqual({ success: false, error: "Failed to apply goals" })
      // The error left the transaction callback, which is what rolls it back.
      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
      expect(revalidatePath).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalled()
    })

    it("never throws, even when the transaction itself fails", async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error("connection lost"))
      await expect(
        applyGoalsToTiles(BINGO, ["t1"], newGoals(task()))
      ).resolves.toEqual({ success: false, error: "Failed to apply goals" })
    })
  })
})

describe("applyGoalsToTiles: copying a tile's goals", () => {
  it("copies groups, nesting, operators, minimums, order and details with new ids", async () => {
    mockSourceTree()
    goalMax = [4]
    groupMax = [2]

    const result = await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))

    expect(result).toEqual({
      success: true,
      tilesUpdated: 1,
      goalsCreated: 4,
      groupsCreated: 2,
    })

    const [outer, inner] = entriesFor(goalGroups)
    expect(outer?.row).toMatchObject({
      tileId: "t1",
      parentGroupId: null,
      name: "Drops",
      logicalOperator: "AND",
      minRequiredGoals: 1,
      // After the 5 slots the tile already uses.
      orderIndex: 5,
    })
    expect(inner?.row).toMatchObject({
      tileId: "t1",
      parentGroupId: outer?.id,
      logicalOperator: "OR",
      minRequiredGoals: 2,
      orderIndex: 0,
    })
    // New ids: the source ids are never reused.
    expect([outer?.id, inner?.id]).not.toContain("g1")
    expect([outer?.id, inner?.id]).not.toContain("g2")

    const goalEntries = entriesFor(goals)
    const byDescription = (d: string) =>
      goalEntries.find((e) => e.row.description === d)
    expect(byDescription("Abyssal whip")?.row).toMatchObject({
      tileId: "t1",
      parentGroupId: inner?.id,
      goalType: "item",
      targetValue: 1,
      orderIndex: 0,
    })
    expect(byDescription("Dragon warhammer")?.row).toMatchObject({
      parentGroupId: inner?.id,
      targetValue: 2,
      orderIndex: 1,
    })
    expect(byDescription("Do a raid")?.row).toMatchObject({
      parentGroupId: outer?.id,
      goalType: "generic",
      targetValue: 5,
      orderIndex: 1,
    })
    expect(byDescription("Zulrah")?.row).toMatchObject({
      parentGroupId: null,
      goalType: "metric",
      targetValue: 50,
      orderIndex: 6,
    })
    expect(goalEntries.map((e) => e.id)).not.toEqual(
      expect.arrayContaining(["a", "b", "c", "d"])
    )

    const items = entriesFor(itemGoals)
    expect(items).toHaveLength(2)
    expect(items[0]?.row).toMatchObject({
      goalId: byDescription("Abyssal whip")?.id,
      itemId: 4151,
      baseName: "Abyssal whip",
      exactVariant: null,
      imageUrl: "https://example.com/item.png",
    })
    expect(rowsFor(metricGoals)[0]).toMatchObject({
      goalId: byDescription("Zulrah")?.id,
      metricType: "boss",
      metricName: "zulrah",
    })
  })

  it("copies only definitions, never progress or values", async () => {
    mockSourceTree()
    await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))

    for (const row of rowsFor(goals)) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "description",
          "goalType",
          "orderIndex",
          "parentGroupId",
          "targetValue",
          "tileId",
        ].sort()
      )
    }
    const serialised = JSON.stringify(inserted.map((i) => i.row))
    expect(serialised).not.toContain("teamProgress")
    expect(serialised).not.toContain("goalValues")
    expect(serialised).not.toContain("currentValue")
  })

  it("copies to several tiles, each after its own existing goals", async () => {
    mockSourceTree()
    goalMax = [0, null]
    groupMax = [null, null]

    const result = await applyGoalsToTiles(BINGO, ["t1", "t2"], copyOf("src"))

    expect(result).toMatchObject({
      success: true,
      tilesUpdated: 2,
      goalsCreated: 8,
      groupsCreated: 4,
    })
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    const outerGroups = rowsFor(goalGroups).filter(
      (r) => r.parentGroupId === null
    )
    expect(outerGroups.map((r) => [r.tileId, r.orderIndex])).toEqual([
      ["t1", 1],
      ["t2", 0],
    ])
    // Each tile gets its own nested group, not the other tile's.
    const [outer1, , outer2] = entriesFor(goalGroups)
    expect(entriesFor(goalGroups)[1]?.row.parentGroupId).toBe(outer1?.id)
    expect(entriesFor(goalGroups)[3]?.row.parentGroupId).toBe(outer2?.id)
  })

  it("keeps the order of siblings, groups before goals on a tie", async () => {
    tx.query.goalGroups.findMany.mockResolvedValue([
      srcGroup({ id: "g1", orderIndex: 1 }),
    ])
    tx.query.goals.findMany.mockResolvedValue([
      srcGoal({ id: "late", description: "Late", orderIndex: 2 }),
      srcGoal({ id: "tie", description: "Tie", orderIndex: 1 }),
      srcGoal({ id: "early", description: "Early", orderIndex: 0 }),
    ])

    await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))

    const sequence = inserted
      .filter((i) => i.table === goals || i.table === goalGroups)
      .map((i) => i.row.description ?? "group")
    expect(sequence).toEqual(["Early", "group", "Tie", "Late"])
    expect(
      inserted.map((i) => i.row.orderIndex).filter((n) => n !== undefined)
    ).toEqual([0, 1, 2, 3])
  })

  it("copies an empty group as it is", async () => {
    tx.query.goalGroups.findMany.mockResolvedValue([
      srcGroup({ id: "g1", logicalOperator: "OR", minRequiredGoals: 3 }),
    ])
    tx.query.goals.findMany.mockResolvedValue([])

    const result = await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))

    expect(result).toMatchObject({ goalsCreated: 0, groupsCreated: 1 })
    expect(rowsFor(goalGroups)[0]).toMatchObject({
      logicalOperator: "OR",
      minRequiredGoals: 3,
    })
  })

  it("rejects a source from another board", async () => {
    mockSourceTree()
    const result = await applyGoalsToTiles(
      BINGO,
      ["t1"],
      copyOf("foreign-tile")
    )
    expect(result).toEqual({
      success: false,
      error: "Some of the selected tiles are not on this board",
    })
    expect(inserted).toHaveLength(0)
    expect(tx.query.goals.findMany).not.toHaveBeenCalled()
  })

  it("rejects copying a tile's goals onto itself", async () => {
    mockSourceTree()
    const result = await applyGoalsToTiles(BINGO, ["t1", "src"], copyOf("src"))
    expect(result).toEqual({
      success: false,
      error: "A tile cannot receive a copy of its own goals",
    })
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("rejects a source without goals", async () => {
    const result = await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))
    expect(result).toEqual({
      success: false,
      error: "The source tile has no goals to copy",
    })
    expect(inserted).toHaveLength(0)
  })

  it("rejects a source goal that is missing its item details", async () => {
    tx.query.goals.findMany.mockResolvedValue([
      srcGoal({ goalType: "item", itemGoal: null }),
    ])
    const result = await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/cannot be copied/)
    expect(inserted).toHaveLength(0)
  })

  it("rejects a copy that would create more than 500 goals and groups", async () => {
    mockSourceTree() // 6 rows per tile
    const ids = Array.from({ length: 84 }, (_, i) => `tile-${i}`)
    boardTiles = new Set([...ids, "src"])

    const result = await applyGoalsToTiles(BINGO, ids, copyOf("src"))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/limit is 500/)
    expect(inserted).toHaveLength(0)
  })

  it("rejects more than 100 tiles", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `tile-${i}`)
    const result = await applyGoalsToTiles(BINGO, ids, copyOf("src"))
    expect(result.success).toBe(false)
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("rejects a caller who does not manage the event", async () => {
    mockSourceTree()
    role.mockResolvedValue("participant")
    const result = await applyGoalsToTiles(BINGO, ["t1"], copyOf("src"))
    expect(result.success).toBe(false)
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("reports a failure instead of throwing when an insert fails part way", async () => {
    mockSourceTree()
    let calls = 0
    const original = tx.insert.getMockImplementation()!
    tx.insert.mockImplementation((table: unknown) => {
      calls++
      if (calls > 3) throw new Error("boom")
      return original(table)
    })

    const result = await applyGoalsToTiles(BINGO, ["t1", "t2"], copyOf("src"))

    expect(result).toEqual({ success: false, error: "Failed to apply goals" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
