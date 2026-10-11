import type { GoalGroup, GoalTreeNode } from "@/app/actions/goal-groups"

export type GroupOperator = "AND" | "OR" | "SUM"
export type GoalType = "generic" | "item" | "metric"
export type MetricType = "skill" | "boss" | "activity"

/**
 * Goal payload of a tree node. `GoalTreeNode` does not declare `metricGoal`,
 * but the page and `getGoalTree` load it with every metric Goal.
 */
export type GoalNodeData = Extract<
  GoalTreeNode["data"],
  { description: string }
> & {
  metricGoal?: { metricType: string; metricName: string } | null
}

interface FlatNodeBase {
  id: string
  parentId: string | null
  depth: number
  orderIndex: number
  parentOperator?: GroupOperator
}

export interface FlatGroupNode extends FlatNodeBase {
  type: "group"
  data: GoalGroup
}

export interface FlatGoalNode extends FlatNodeBase {
  type: "goal"
  data: GoalNodeData
}

/** A visible tree node with its position, as used for rendering and drag and drop. */
export type FlatNode = FlatGroupNode | FlatGoalNode
