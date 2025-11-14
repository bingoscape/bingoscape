/**
 * Type definitions for RuneLite API responses
 * These types define the structure of data returned to the RuneLite plugin
 */

/**
 * Item goal metadata - includes OSRS item information
 */
export interface ItemGoalData {
  itemId: number
  baseName: string
  exactVariant: string | null
  imageUrl: string
}

/**
 * Pre-defined submission value option for a goal
 */
export interface GoalValueData {
  id: string
  value: number
  description: string
}

/**
 * Unified progress information for goals and groups
 * Matches the Java GoalTreeProgress model in the RuneLite plugin
 */
export interface GoalProgressData {
  completedCount: number
  totalCount: number
  isComplete: boolean
}

/**
 * Type alias for group progress (same structure as goal progress)
 */
export type GroupProgressData = GoalProgressData

/**
 * Base properties shared by all goal tree nodes
 */
interface BaseGoalTreeNode {
  type: "goal" | "group"
  id: string
  orderIndex: number
}

/**
 * Goal node in the goal tree
 */
export interface GoalNode extends BaseGoalTreeNode {
  type: "goal"
  description: string
  targetValue: number | null
  goalType: "generic" | "item"
  itemGoal?: ItemGoalData
  goalValues?: GoalValueData[]
  progress?: GoalProgressData
}

/**
 * Group node in the goal tree (contains nested goals/groups)
 */
export interface GroupNode extends BaseGoalTreeNode {
  type: "group"
  name: string | null
  logicalOperator: "AND" | "OR"
  minRequiredGoals: number
  progress?: GroupProgressData
  children: GoalTreeNode[]
}

/**
 * Recursive goal tree node - can be either a goal or a group
 */
export type GoalTreeNode = GoalNode | GroupNode

/**
 * Type guard to check if a node is a goal
 */
export function isGoalNode(node: GoalTreeNode): node is GoalNode {
  return node.type === "goal"
}

/**
 * Type guard to check if a node is a group
 */
export function isGroupNode(node: GoalTreeNode): node is GroupNode {
  return node.type === "group"
}
