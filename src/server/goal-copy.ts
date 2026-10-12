import { validateNewGoal, type NewGoalInput } from "@/server/goal-create"

/**
 * Turns the stored goal tree of a tile into a plan for creating the same
 * definitions on another tile: groups with their operator, minimum count and
 * name, goals with their item or metric details, nesting and order. Only
 * definitions are planned. Progress, goal values and submissions are never
 * part of a plan. Pure (no database), so it can be tested on its own.
 */

export interface SourceGroup {
  id: string
  parentGroupId: string | null
  name: string | null
  logicalOperator: "AND" | "OR" | "SUM"
  minRequiredGoals: number
  orderIndex: number
}

export interface SourceGoal {
  id: string
  parentGroupId: string | null
  description: string
  targetValue: number
  goalType: "generic" | "item" | "metric"
  orderIndex: number
  itemGoal?: {
    itemId: number
    baseName: string
    exactVariant: string | null
    imageUrl: string
  } | null
  metricGoal?: { metricType: string; metricName: string } | null
}

export type PlanNode =
  | {
      kind: "group"
      name: string | null
      operator: "AND" | "OR" | "SUM"
      minRequiredGoals: number
      children: PlanNode[]
    }
  | { kind: "goal"; input: NewGoalInput }

export interface CopyPlan {
  nodes: PlanNode[]
  goalCount: number
  groupCount: number
}

export type CopyPlanResult =
  | { ok: true; plan: CopyPlan }
  | { ok: false; error: string }

/** The goal as the input `insertGoal` takes, or null when its details are missing. */
function goalToInput(goal: SourceGoal): NewGoalInput | null {
  if (goal.goalType === "item") {
    const item = goal.itemGoal
    if (!item) return null
    return {
      type: "item",
      itemId: item.itemId,
      itemName: goal.description,
      baseName: item.baseName,
      imageUrl: item.imageUrl,
      targetValue: goal.targetValue,
      exactVariant: item.exactVariant,
    }
  }
  if (goal.goalType === "metric") {
    const metric = goal.metricGoal
    if (!metric) return null
    return {
      type: "metric",
      metricType: metric.metricType,
      metricName: metric.metricName,
      targetValue: goal.targetValue,
      description: goal.description,
    }
  }
  return {
    type: "generic",
    description: goal.description,
    targetValue: goal.targetValue,
  }
}

/**
 * Plans a copy of the tile's goal tree. Siblings keep their relative order
 * (groups before goals on equal order indexes, as the tile panel shows them).
 * Fails, without a partial plan, when the tile has nothing to copy or a goal
 * cannot be recreated as it is stored.
 */
export function buildCopyPlan(
  groups: readonly SourceGroup[],
  goals: readonly SourceGoal[]
): CopyPlanResult {
  if (groups.length === 0 && goals.length === 0) {
    return { ok: false, error: "The source tile has no goals to copy" }
  }

  let goalCount = 0
  let groupCount = 0
  // An object, so TypeScript does not narrow it to null across the closure.
  const state: { failure: string | null } = { failure: null }

  const build = (parentId: string | null): PlanNode[] => {
    const siblings = [
      ...groups
        .filter((group) => group.parentGroupId === parentId)
        .map((group) => ({ group, order: group.orderIndex, rank: 0 })),
      ...goals
        .filter((goal) => goal.parentGroupId === parentId)
        .map((goal) => ({ goal, order: goal.orderIndex, rank: 1 })),
    ].sort((a, b) => a.order - b.order || a.rank - b.rank)

    const nodes: PlanNode[] = []
    for (const sibling of siblings) {
      if ("group" in sibling) {
        groupCount++
        nodes.push({
          kind: "group",
          name: sibling.group.name,
          operator: sibling.group.logicalOperator,
          minRequiredGoals: sibling.group.minRequiredGoals,
          children: build(sibling.group.id),
        })
        continue
      }
      const input = goalToInput(sibling.goal)
      const error = input
        ? validateNewGoal(input)
        : "a goal is missing its item or metric details"
      if (error) {
        state.failure ??= `The source tile has a goal that cannot be copied: ${error}`
        continue
      }
      if (input) {
        goalCount++
        nodes.push({ kind: "goal", input })
      }
    }
    return nodes
  }

  const nodes = build(null)
  if (state.failure) return { ok: false, error: state.failure }
  if (nodes.length === 0) {
    return { ok: false, error: "The source tile has no goals to copy" }
  }
  return { ok: true, plan: { nodes, goalCount, groupCount } }
}
