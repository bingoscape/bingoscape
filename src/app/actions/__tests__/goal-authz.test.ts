/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getUserRole } from "@/app/actions/events"
import { addGoalValue, deleteGoalValue, getGoalValues } from "@/app/actions/goals"
import {
  createGoalGroup,
  deleteGoalGroup,
  getGoalTree,
  moveGoalToGroup,
  moveMultipleItems,
  reorderItems,
  updateGoalGroup,
} from "@/app/actions/goal-groups"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/app/actions/events", () => ({ getUserRole: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => {
  const table = () => ({ findFirst: jest.fn(), findMany: jest.fn() })
  const tx = {
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  return {
    db: {
      query: {
        bingos: table(),
        tiles: table(),
        goals: table(),
        goalGroups: table(),
        goalValues: table(),
        submissions: table(),
        teamTileSubmissions: table(),
      },
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      __tx: tx,
    },
  }
})

const session = getServerAuthSession as jest.Mock
const role = getUserRole as jest.Mock
const mockDb = db as unknown as {
  query: Record<string, { findFirst: jest.Mock; findMany: jest.Mock }>
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  transaction: jest.Mock
  __tx: { insert: jest.Mock; update: jest.Mock; delete: jest.Mock }
}
const q = mockDb.query as Record<
  string,
  { findFirst: jest.Mock; findMany: jest.Mock }
>

/** The Board a Tile is read from, as `canReadTile` loads it. */
const standardBingo = (eventId: string) => ({
  eventId,
  bingoType: "standard",
  event: { startDate: new Date(0) },
})

const goalInEvent = (eventId: string) => ({
  tileId: "tile-1",
  tile: { bingoId: "bingo-1", bingo: { eventId } },
})

function expectNoWrites() {
  expect(mockDb.insert).not.toHaveBeenCalled()
  expect(mockDb.update).not.toHaveBeenCalled()
  expect(mockDb.delete).not.toHaveBeenCalled()
  expect(mockDb.transaction).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.clearAllMocks()
  session.mockResolvedValue({ user: { id: "user-1" } })
  q.goals!.findFirst.mockResolvedValue(goalInEvent("event-1"))
  q.goalGroups!.findFirst.mockResolvedValue(goalInEvent("event-1"))
  q.goalValues!.findFirst.mockResolvedValue({ goalId: "goal-1" })
  q.tiles!.findFirst.mockResolvedValue({
    bingoId: "bingo-1",
    isHidden: false,
    bingo: standardBingo("event-1"),
  })
  q.goalGroups!.findMany.mockResolvedValue([])
  q.goals!.findMany.mockResolvedValue([])
  // transaction callback gets a chainable tx
  const chain = () => {
    const c: Record<string, jest.Mock> = {}
    c.values = jest.fn(() => c)
    c.set = jest.fn(() => c)
    c.where = jest.fn(() => c)
    c.returning = jest.fn(async () => [{ id: "new" }])
    return c
  }
  mockDb.__tx.insert.mockImplementation(chain)
  mockDb.__tx.update.mockImplementation(chain)
  mockDb.__tx.delete.mockImplementation(() => ({ where: jest.fn() }))
})

describe.each([["participant"], [null]])(
  "goal mutations for a caller with role %s",
  (callerRole) => {
    beforeEach(() => {
      role.mockResolvedValue(callerRole)
    })

    it("addGoalValue is rejected", async () => {
      const result = await addGoalValue("goal-1", 5, "five")
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("deleteGoalValue is rejected", async () => {
      const result = await deleteGoalValue("value-1")
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("createGoalGroup is rejected", async () => {
      const result = await createGoalGroup("tile-1", "AND")
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("updateGoalGroup is rejected", async () => {
      const result = await updateGoalGroup("group-1", { name: "x" })
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("deleteGoalGroup is rejected", async () => {
      const result = await deleteGoalGroup("group-1")
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("moveGoalToGroup is rejected", async () => {
      const result = await moveGoalToGroup("goal-1", "group-1")
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("reorderItems is rejected", async () => {
      const result = await reorderItems([
        { id: "goal-1", type: "goal", orderIndex: 0 },
      ])
      expect(result.success).toBe(false)
      expectNoWrites()
    })

    it("moveMultipleItems is rejected", async () => {
      const result = await moveMultipleItems(
        [{ id: "goal-1", type: "goal" }],
        "group-1"
      )
      expect(result.success).toBe(false)
      expectNoWrites()
    })
  }
)

describe("goal mutations when the caller is not signed in", () => {
  it("rejects with Unauthorized", async () => {
    session.mockResolvedValue(null)
    role.mockResolvedValue(null)
    const result = await addGoalValue("goal-1", 1, "x")
    expect(result).toEqual({ success: false, error: "Unauthorized" })
    expectNoWrites()
  })
})

describe.each([["admin"], ["management"]])(
  "goal mutations for a caller with role %s",
  (callerRole) => {
    beforeEach(() => {
      role.mockResolvedValue(callerRole)
    })

    it("addGoalValue succeeds and checks the Event derived from the Goal", async () => {
      const result = await addGoalValue("goal-1", 5, "five")
      expect(result.success).toBe(true)
      expect(role).toHaveBeenCalledWith("event-1")
      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it("deleteGoalValue succeeds", async () => {
      const result = await deleteGoalValue("value-1")
      expect(result.success).toBe(true)
    })

    it("createGoalGroup succeeds", async () => {
      const result = await createGoalGroup("tile-1", "OR")
      expect(result.success).toBe(true)
    })

    it("moveGoalToGroup refuses a target group from another Event", async () => {
      q.goals!.findFirst.mockResolvedValue(goalInEvent("event-1"))
      q.goalGroups!.findFirst.mockResolvedValue(goalInEvent("event-2"))
      const result = await moveGoalToGroup("goal-1", "group-from-event-2")
      expect(result.success).toBe(false)
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  }
)

describe("hidden Tile Goals are not readable by non-managers", () => {
  beforeEach(() => {
    q.tiles!.findFirst.mockResolvedValue({
      isHidden: true,
      bingoId: "bingo-1",
      bingo: standardBingo("event-1"),
    })
    q.goals!.findFirst.mockResolvedValue({ tileId: "tile-1" })
  })

  it("getGoalTree returns nothing for a participant", async () => {
    role.mockResolvedValue("participant")
    await expect(getGoalTree("tile-1")).resolves.toEqual([])
    expect(q.goals!.findMany).not.toHaveBeenCalled()
  })

  it("getGoalValues returns nothing for a participant", async () => {
    role.mockResolvedValue("participant")
    await expect(getGoalValues("goal-1")).resolves.toEqual([])
    expect(q.goalValues!.findMany).not.toHaveBeenCalled()
  })

  it("getGoalTree is available to managers", async () => {
    role.mockResolvedValue("admin")
    await expect(getGoalTree("tile-1")).resolves.toEqual([])
    expect(q.goals!.findMany).toHaveBeenCalled()
  })
})
