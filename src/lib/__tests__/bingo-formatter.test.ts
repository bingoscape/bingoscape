import { calculateGroupProgress } from "../bingo-formatter"
import type { GroupNode } from "@/types/runelite-api"

describe("calculateGroupProgress", () => {
  const allGoals: Array<{ id: string; targetValue: number }> = []
  const teamProgressMap = new Map<string, number>()

  beforeEach(() => {
    teamProgressMap.clear()
  })

  describe("SUM operator", () => {
    it("should pool progress from multiple goals against a sum target", () => {
      teamProgressMap.set("goal-1", 4)
      teamProgressMap.set("goal-2", 3)

      const groupNode: GroupNode = {
        type: "group",
        id: "group-1",
        name: "Sum Group",
        logicalOperator: "SUM",
        minRequiredGoals: 10,
        orderIndex: 0,
        children: [
          {
            type: "goal",
            id: "goal-1",
            targetValue: 5,
            description: "Goal 1",
            orderIndex: 0,
            goalType: "generic",
          },
          {
            type: "goal",
            id: "goal-2",
            targetValue: 5,
            description: "Goal 2",
            orderIndex: 1,
            goalType: "generic",
          },
        ],
      }

      const result = calculateGroupProgress(
        groupNode,
        allGoals,
        teamProgressMap
      )
      expect(result.completedCount).toBe(7)
      expect(result.totalCount).toBe(10)
      expect(result.isComplete).toBe(false)
    })

    it("should mark as complete when pooled progress meets or exceeds target", () => {
      teamProgressMap.set("goal-1", 6)
      teamProgressMap.set("goal-2", 4)

      const groupNode: GroupNode = {
        type: "group",
        id: "group-1",
        name: "Sum Group",
        logicalOperator: "SUM",
        minRequiredGoals: 10,
        orderIndex: 0,
        children: [
          {
            type: "goal",
            id: "goal-1",
            targetValue: 5,
            description: "Goal 1",
            orderIndex: 0,
            goalType: "generic",
          },
          {
            type: "goal",
            id: "goal-2",
            targetValue: 5,
            description: "Goal 2",
            orderIndex: 1,
            goalType: "generic",
          },
        ],
      }

      const result = calculateGroupProgress(
        groupNode,
        allGoals,
        teamProgressMap
      )
      expect(result.completedCount).toBe(10)
      expect(result.totalCount).toBe(10)
      expect(result.isComplete).toBe(true)
    })

    it("should properly sum nested AND/OR groups", () => {
      teamProgressMap.set("goal-1", 1)
      teamProgressMap.set("goal-2", 1)
      teamProgressMap.set("goal-3", 1)

      const groupNode: GroupNode = {
        type: "group",
        id: "group-sum",
        name: "Sum Group",
        logicalOperator: "SUM",
        minRequiredGoals: 2,
        orderIndex: 0,
        children: [
          {
            type: "group",
            id: "group-and",
            name: "AND Group",
            logicalOperator: "AND",
            minRequiredGoals: 2,
            orderIndex: 0,
            children: [
              {
                type: "goal",
                id: "goal-1",
                targetValue: 1,
                description: "",
                orderIndex: 0,
                goalType: "generic",
              },
              {
                type: "goal",
                id: "goal-2",
                targetValue: 1,
                description: "",
                orderIndex: 1,
                goalType: "generic",
              },
            ],
          },
          {
            type: "group",
            id: "group-or",
            name: "OR Group",
            logicalOperator: "OR",
            minRequiredGoals: 1,
            orderIndex: 1,
            children: [
              {
                type: "goal",
                id: "goal-3",
                targetValue: 1,
                description: "",
                orderIndex: 0,
                goalType: "generic",
              },
              {
                type: "goal",
                id: "goal-4",
                targetValue: 1,
                description: "",
                orderIndex: 1,
                goalType: "generic",
              },
            ],
          },
        ],
      }

      const result = calculateGroupProgress(
        groupNode,
        allGoals,
        teamProgressMap
      )
      expect(result.completedCount).toBe(2)
      expect(result.totalCount).toBe(2)
      expect(result.isComplete).toBe(true)
    })

    it("should handle empty groups gracefully", () => {
      const groupNode: GroupNode = {
        type: "group",
        id: "group-1",
        name: "Sum Group",
        logicalOperator: "SUM",
        minRequiredGoals: 5,
        orderIndex: 0,
        children: [],
      }

      const result = calculateGroupProgress(
        groupNode,
        allGoals,
        teamProgressMap
      )
      expect(result.completedCount).toBe(0)
      expect(result.totalCount).toBe(5)
      expect(result.isComplete).toBe(false)
    })
  })

  describe("AND operator", () => {
    it("should only be complete when all children are complete", () => {
      teamProgressMap.set("goal-1", 1)

      const groupNode: GroupNode = {
        type: "group",
        id: "group-1",
        name: "AND Group",
        logicalOperator: "AND",
        minRequiredGoals: 0,
        orderIndex: 0,
        children: [
          {
            type: "goal",
            id: "goal-1",
            targetValue: 1,
            description: "",
            orderIndex: 0,
            goalType: "generic",
          },
          {
            type: "goal",
            id: "goal-2",
            targetValue: 1,
            description: "",
            orderIndex: 1,
            goalType: "generic",
          },
        ],
      }

      const result = calculateGroupProgress(
        groupNode,
        allGoals,
        teamProgressMap
      )
      expect(result.completedCount).toBe(1)
      expect(result.totalCount).toBe(2)
      expect(result.isComplete).toBe(false)
    })
  })
})
