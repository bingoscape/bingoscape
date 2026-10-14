/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getEventActor } from "@/server/authz/actor"
import { actorLookup } from "@/server/__tests__/helpers/mock-actor"
import {
  addGoal,
  createGoals,
  createItemGoal,
  createMetricGoal,
  type NewGoalInput,
} from "@/app/actions/bingo"
import { goalGroups, goals, itemGoals, metricGoals } from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
// The actor lookup is the seam: every guard resolves the caller through it.
jest.mock("@/server/authz/actor", () => ({
  getEventActor: jest.fn(),
  getEventRole: jest.fn(),
  isUuid: () => true,
}))
jest.mock("@/server/notifications", () => ({
  createNotification: jest.fn(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => {
  const table = () => ({ findFirst: jest.fn(), findMany: jest.fn() })
  const tx = { insert: jest.fn(), select: jest.fn() }
  return {
    db: {
      query: { tiles: table(), goalGroups: table() },
      transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      __tx: tx,
    },
  }
})

const session = getServerAuthSession as jest.Mock
const actor = getEventActor as jest.Mock
/** The caller's standing in the Event, as the actor loader reports it. */
const role = {
  mockResolvedValue: (r: string | null) =>
    actor.mockResolvedValue(actorLookup(r)),
}
const mockDb = db as unknown as {
  query: Record<string, { findFirst: jest.Mock }>
  transaction: jest.Mock
  __tx: { insert: jest.Mock; select: jest.Mock }
}
const tx = mockDb.__tx

/** Rows passed to tx.insert(table).values(row), in call order. */
let inserted: { table: unknown; row: Record<string, unknown> }[]
let nextId: number
/** What `max(order_index)` returns for goals / goal groups under the parent. */
let maxIndex: { goals: number | null; groups: number | null }

const genericGoal = (
  overrides: Partial<Extract<NewGoalInput, { type: "generic" }>> = {}
): NewGoalInput => ({
  type: "generic",
  description: "Do the thing",
  targetValue: 1,
  ...overrides,
})

const itemGoal = (name: string): NewGoalInput => ({
  type: "item",
  itemId: 4151,
  itemName: name,
  baseName: name,
  imageUrl: "https://example.com/item.png",
  targetValue: 2,
})

beforeEach(() => {
  jest.clearAllMocks()
  inserted = []
  nextId = 1
  maxIndex = { goals: null, groups: null }
  session.mockResolvedValue({ user: { id: "user-1" } })
  role.mockResolvedValue("admin")
  mockDb.query.tiles!.findFirst.mockResolvedValue({
    bingoId: "bingo-1",
    bingo: { eventId: "event-1" },
  })
  mockDb.query.goalGroups!.findFirst.mockResolvedValue({ tileId: "tile-1" })

  tx.insert.mockImplementation((table: unknown) => ({
    values: (row: Record<string, unknown>) => {
      inserted.push({ table, row })
      return { returning: async () => [{ ...row, id: `id-${nextId++}` }] }
    },
  }))
  tx.select.mockImplementation(() => ({
    from: (table: unknown) => ({
      where: async () => [
        { value: table === goals ? maxIndex.goals : maxIndex.groups },
      ],
    }),
  }))
})

const rowsFor = (table: unknown) =>
  inserted.filter((i) => i.table === table).map((i) => i.row)

describe("createGoals", () => {
  it("creates all goals in one transaction with sequential order indexes", async () => {
    maxIndex = { goals: 3, groups: 1 }
    const result = await createGoals("tile-1", [
      itemGoal("Abyssal whip"),
      itemGoal("Dragon bones"),
    ])

    expect(result.success).toBe(true)
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(rowsFor(goals).map((r) => r.orderIndex)).toEqual([4, 5])
    expect(rowsFor(goals).map((r) => r.goalType)).toEqual(["item", "item"])
    expect(rowsFor(itemGoals)).toHaveLength(2)
  })

  it("starts order indexes at 0 on an empty tile", async () => {
    await createGoals("tile-1", [genericGoal()])
    expect(rowsFor(goals)[0]?.orderIndex).toBe(0)
  })

  it("places goals in the given parent group", async () => {
    await createGoals("tile-1", [genericGoal()], { parentGroupId: "group-1" })
    expect(rowsFor(goals)[0]?.parentGroupId).toBe("group-1")
  })

  it("wraps the goals in a new group created in the same transaction", async () => {
    maxIndex = { goals: 0, groups: 2 }
    const result = await createGoals(
      "tile-1",
      [itemGoal("A"), itemGoal("B"), itemGoal("C")],
      { group: { operator: "OR", minRequiredGoals: 2 } }
    )

    expect(result.success).toBe(true)
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    const [group] = rowsFor(goalGroups)
    expect(group).toMatchObject({
      tileId: "tile-1",
      parentGroupId: null,
      logicalOperator: "OR",
      minRequiredGoals: 2,
      orderIndex: 3,
    })
    const newGroupId = result.success ? result.groupId : null
    expect(newGroupId).toBe("id-1")
    expect(rowsFor(goals).map((r) => r.parentGroupId)).toEqual([
      newGroupId,
      newGroupId,
      newGroupId,
    ])
    expect(rowsFor(goals).map((r) => r.orderIndex)).toEqual([0, 1, 2])
  })

  it("creates a metric goal with a readable description", async () => {
    await createGoals("tile-1", [
      {
        type: "metric",
        metricType: "boss",
        metricName: "abyssal_sire",
        targetValue: 50,
      },
    ])
    expect(rowsFor(goals)[0]).toMatchObject({
      description: "Abyssal Sire",
      goalType: "metric",
    })
    expect(rowsFor(metricGoals)[0]).toMatchObject({
      metricType: "boss",
      metricName: "abyssal_sire",
    })
  })

  it("rolls back by surfacing the error when an insert fails", async () => {
    tx.insert.mockImplementationOnce(() => {
      throw new Error("boom")
    })
    const result = await createGoals("tile-1", [genericGoal()])
    expect(result).toMatchObject({ success: false, error: "Failed to create goals" })
  })

  describe("validation (nothing is written)", () => {
    it.each([
      ["zero target", genericGoal({ targetValue: 0 })],
      ["negative target", genericGoal({ targetValue: -1 })],
      ["fractional target", genericGoal({ targetValue: 1.5 })],
      ["NaN target", genericGoal({ targetValue: Number.NaN })],
      ["oversized target", genericGoal({ targetValue: 2_147_483_648 })],
      ["blank description", genericGoal({ description: "   " })],
    ])("rejects %s", async (_label, input) => {
      const result = await createGoals("tile-1", [input])
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("names the offending goal in a batch", async () => {
      const result = await createGoals("tile-1", [
        genericGoal(),
        genericGoal({ targetValue: 0 }),
      ])
      expect(result).toEqual({
        success: false,
        error: "Goal 2: Target value must be greater than 0",
      })
    })

    it("rejects an empty batch", async () => {
      const result = await createGoals("tile-1", [])
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects more than the batch limit", async () => {
      const result = await createGoals(
        "tile-1",
        Array.from({ length: 101 }, () => genericGoal())
      )
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects an OR group that requires more goals than it has", async () => {
      const result = await createGoals(
        "tile-1",
        [genericGoal(), genericGoal()],
        { group: { operator: "OR", minRequiredGoals: 3 } }
      )
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects a parent group that belongs to another tile", async () => {
      mockDb.query.goalGroups!.findFirst.mockResolvedValue({
        tileId: "tile-2",
      })
      const result = await createGoals("tile-1", [genericGoal()], {
        parentGroupId: "group-from-tile-2",
      })
      expect(result).toMatchObject({ success: false, error: "Goal group not found" })
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it("rejects a missing parent group", async () => {
      mockDb.query.goalGroups!.findFirst.mockResolvedValue(undefined)
      const result = await createGoals("tile-1", [genericGoal()], {
        parentGroupId: "missing",
      })
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })

  describe.each([["participant"], [null]])("for a caller with role %s", (r) => {
    it("is rejected without writing", async () => {
      role.mockResolvedValue(r)
      const result = await createGoals("tile-1", [genericGoal()])
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })
})

describe("single-goal wrappers", () => {
  it("addGoal honours the parent group and returns the goal", async () => {
    const result = await addGoal("tile-1", {
      description: "  Hello ",
      targetValue: 3,
      parentGroupId: "group-1",
    })
    expect(result.success).toBe(true)
    expect(rowsFor(goals)[0]).toMatchObject({
      description: "Hello",
      targetValue: 3,
      parentGroupId: "group-1",
    })
  })

  it("addGoal rejects an empty description", async () => {
    const result = await addGoal("tile-1", { description: "", targetValue: 1 })
    expect(result).toEqual({
      success: false,
      error: "Description cannot be empty",
    })
  })

  it("addGoal rejects a NaN target", async () => {
    const result = await addGoal("tile-1", {
      description: "x",
      targetValue: Number.NaN,
    })
    expect(result.success).toBe(false)
  })

  it("createItemGoal honours the parent group and keeps its return shape", async () => {
    const result = await createItemGoal(
      "tile-1",
      4151,
      "Abyssal whip",
      "Abyssal whip",
      "https://example.com/whip.png",
      1,
      null,
      "group-1"
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.goal).toBeDefined()
      expect(result.itemGoal).toBeDefined()
    }
    expect(rowsFor(goals)[0]?.parentGroupId).toBe("group-1")
  })

  it("createMetricGoal honours the parent group", async () => {
    const result = await createMetricGoal(
      "tile-1",
      "skill",
      "attack",
      1_000_000,
      undefined,
      "group-1"
    )
    expect(result.success).toBe(true)
    expect(rowsFor(goals)[0]?.parentGroupId).toBe("group-1")
  })
})
