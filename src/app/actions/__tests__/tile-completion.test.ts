import { evaluateGroup } from "../tile-completion"
import { db } from "@/server/db"

jest.mock("@/server/db", () => ({
  db: {
    query: {
      goalGroups: {
        findFirst: jest.fn(),
      },
      goals: {
        findFirst: jest.fn(),
      },
      teamGoalProgress: {
        findFirst: jest.fn(),
      },
    },
  },
}))

describe("evaluateGroup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should pool progress from children goals for SUM operator", async () => {
    ;(db.query.goalGroups.findFirst as jest.Mock).mockResolvedValue({
      id: "group-sum",
      logicalOperator: "SUM",
      minRequiredGoals: 10,
      childGroups: [],
      goals: [
        { id: "goal-1" },
        { id: "goal-2" }
      ]
    })

    ;(db.query.goals.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: "goal-1", targetValue: 5 })
      .mockResolvedValueOnce({ id: "goal-2", targetValue: 5 })

    ;(db.query.teamGoalProgress.findFirst as jest.Mock)
      .mockResolvedValueOnce({ currentValue: 4 })
      .mockResolvedValueOnce({ currentValue: 7 })

    const result = await evaluateGroup("group-sum", "team-1")
    
    expect(result.currentValue).toBe(11) // 4 + 7
    expect(result.isComplete).toBe(true) // 11 >= 10
  })

  it("should evaluate nested AND/OR groups correctly inside a SUM group", async () => {
    // Return the parent group first, then the child group
    ;(db.query.goalGroups.findFirst as jest.Mock)
      .mockResolvedValueOnce({ 
        id: "group-sum",
        logicalOperator: "SUM",
        minRequiredGoals: 3,
        childGroups: [{ id: "group-and" }],
        goals: [{ id: "goal-1" }]
      })
      .mockResolvedValueOnce({ 
        id: "group-and",
        logicalOperator: "AND",
        childGroups: [],
        goals: [{ id: "goal-2" }, { id: "goal-3" }]
      })

    // evaluateGroup processes childGroups first, then goals.
    // So for group-sum, it calls evaluateGroup("group-and")
    // evaluateGroup("group-and") queries its childGroups (none), then goals (goal-2, goal-3)
    ;(db.query.goals.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: "goal-2", targetValue: 1 })
      .mockResolvedValueOnce({ id: "goal-3", targetValue: 1 })
      // After group-and returns, group-sum processes its goals (goal-1)
      .mockResolvedValueOnce({ id: "goal-1", targetValue: 5 })

    ;(db.query.teamGoalProgress.findFirst as jest.Mock)
      .mockResolvedValueOnce({ currentValue: 1 }) // goal-2 progress
      .mockResolvedValueOnce({ currentValue: 1 }) // goal-3 progress
      .mockResolvedValueOnce({ currentValue: 2 }) // goal-1 progress

    const result = await evaluateGroup("group-sum", "team-1")
    
    // AND group is complete -> contributes 1 to SUM
    // goal-1 progress is 2 -> contributes 2 to SUM
    // SUM total = 3, minRequiredGoals = 3 -> complete
    expect(result.currentValue).toBe(3)
    expect(result.isComplete).toBe(true)
  })

  it("should handle empty SUM groups gracefully", async () => {
    ;(db.query.goalGroups.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "group-sum",
      logicalOperator: "SUM",
      minRequiredGoals: 5,
      childGroups: [],
      goals: []
    })

    const result = await evaluateGroup("group-sum", "team-1")
    expect(result.currentValue).toBe(0)
    expect(result.isComplete).toBe(false)
  })

  it("should handle goals with no progress entries", async () => {
    ;(db.query.goalGroups.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "group-sum",
      logicalOperator: "SUM",
      minRequiredGoals: 10,
      childGroups: [],
      goals: [{ id: "goal-1" }]
    })

    ;(db.query.goals.findFirst as jest.Mock).mockResolvedValueOnce({ id: "goal-1", targetValue: 5 })
    ;(db.query.teamGoalProgress.findFirst as jest.Mock).mockResolvedValueOnce(null)

    const result = await evaluateGroup("group-sum", "team-1")
    expect(result.currentValue).toBe(0)
    expect(result.isComplete).toBe(false)
  })
})
