import type { GoalGroup, GoalTreeNode } from "@/app/actions/goal-groups"
import type { OsrsItem } from "@/types/osrs-items"

export type GroupOperator = "AND" | "OR" | "SUM"
export type GoalType = "generic" | "item" | "metric"
export type MetricType = "skill" | "boss" | "activity"

/** An item picked for a new Goal, with the raw text of its quantity field. */
export interface SelectedItem {
  item: OsrsItem
  quantity: string
}

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
