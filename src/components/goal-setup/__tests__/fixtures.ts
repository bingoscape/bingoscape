import type { Tile } from "@/types/model"

const NOW = new Date("2026-01-01T00:00:00Z")

type GoalKind = "generic" | "item" | "metric"

interface GoalOptions {
  id: string
  tileId: string
  description?: string
  targetValue?: number
  kind?: GoalKind
  parentGroupId?: string | null
  orderIndex?: number
  metric?: { metricType: string; metricName: string }
}

/** A goal as the event page loads it, with its item or metric details. */
export function makeGoal({
  id,
  tileId,
  description = "Do the thing",
  targetValue = 1,
  kind = "generic",
  parentGroupId = null,
  orderIndex = 0,
  metric,
}: GoalOptions) {
  return {
    id,
    tileId,
    parentGroupId,
    description,
    targetValue,
    goalType: kind,
    orderIndex,
    createdAt: NOW,
    updatedAt: NOW,
    goalValues: [],
    teamProgress: [],
    itemGoal:
      kind === "item"
        ? {
            id: `${id}-item`,
            goalId: id,
            itemId: 4151,
            baseName: description,
            exactVariant: null,
            imageUrl: "/whip.png",
            createdAt: NOW,
            updatedAt: NOW,
          }
        : null,
    metricGoal: metric
      ? {
          id: `${id}-metric`,
          goalId: id,
          ...metric,
          createdAt: NOW,
          updatedAt: NOW,
        }
      : null,
  }
}

export function makeGroup(
  id: string,
  tileId: string,
  logicalOperator: "AND" | "OR" | "SUM",
  minRequiredGoals: number,
  parentGroupId: string | null = null,
  orderIndex = 0
) {
  return {
    id,
    tileId,
    parentGroupId,
    name: null,
    logicalOperator,
    minRequiredGoals,
    orderIndex,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

interface TileOptions {
  id: string
  index: number
  title: string
  isHidden?: boolean
  goals?: ReturnType<typeof makeGoal>[]
  goalGroups?: ReturnType<typeof makeGroup>[]
}

export function makeTile({
  id,
  index,
  title,
  isHidden = false,
  goals = [],
  goalGroups = [],
}: TileOptions): Tile {
  return {
    id,
    bingoId: "bingo-1",
    headerImage: null,
    title,
    description: "",
    weight: 1,
    index,
    isHidden,
    tier: 0,
    createdAt: NOW,
    updatedAt: NOW,
    goals,
    goalGroups,
    teamTileSubmissions: [],
  } as unknown as Tile
}

/**
 * A small board:
 *   1 Fire cape        one item goal
 *   2 Zulrah           an "any 2 of 3" group (kill goal, two items)
 *   3 Dragon pickaxe   no goals
 *   4 Chambers purple  one task
 *   5 Secret           hidden, no goals (never listed)
 *   6 Nex              no goals
 */
export function makeBoard(): Tile[] {
  return [
    makeTile({
      id: "t1",
      index: 0,
      title: "Fire cape",
      goals: [
        makeGoal({
          id: "g1",
          tileId: "t1",
          kind: "item",
          description: "Fire cape",
        }),
      ],
    }),
    makeTile({
      id: "t2",
      index: 1,
      title: "Zulrah",
      goalGroups: [makeGroup("grp", "t2", "OR", 2)],
      goals: [
        makeGoal({
          id: "z1",
          tileId: "t2",
          kind: "metric",
          description: "Zulrah",
          targetValue: 50,
          parentGroupId: "grp",
          metric: { metricType: "boss", metricName: "zulrah" },
        }),
        makeGoal({
          id: "z2",
          tileId: "t2",
          kind: "item",
          description: "Tanzanite fang",
          parentGroupId: "grp",
          orderIndex: 1,
        }),
        makeGoal({
          id: "z3",
          tileId: "t2",
          kind: "item",
          description: "Magic fang",
          parentGroupId: "grp",
          orderIndex: 2,
        }),
      ],
    }),
    makeTile({ id: "t3", index: 2, title: "Dragon pickaxe" }),
    makeTile({
      id: "t4",
      index: 3,
      title: "Chambers purple",
      goals: [
        makeGoal({
          id: "g4",
          tileId: "t4",
          description: "Complete 5 raids",
          targetValue: 5,
        }),
      ],
    }),
    makeTile({ id: "t5", index: 4, title: "Secret", isHidden: true }),
    makeTile({ id: "t6", index: 5, title: "Nex" }),
  ]
}
