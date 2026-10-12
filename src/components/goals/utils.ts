import type { GoalGroup, GoalTreeNode } from "@/app/actions/goal-groups"
import type { OsrsItem } from "@/types/osrs-items"
import type { FlatNode, GroupOperator } from "./types"

/**
 * Flattens the Goal tree into the list of currently visible nodes (children of
 * collapsed groups are skipped), in render order.
 */
export function flattenGoalTree(
  nodes: GoalTreeNode[],
  expandedGroups: ReadonlySet<string>,
  parentId: string | null = null,
  parentOperator?: GroupOperator,
  depth = 0
): FlatNode[] {
  return nodes.flatMap((node, index) => {
    // The node's `type` and `data` are correlated, which the loose
    // `GoalTreeNode` type cannot express.
    const flatNode = {
      id: node.id,
      type: node.type,
      data: node.data,
      parentId,
      depth,
      orderIndex: index,
      parentOperator,
    } as FlatNode

    if (
      node.type === "group" &&
      node.children &&
      expandedGroups.has(node.id)
    ) {
      const groupOperator = (node.data as GoalGroup | undefined)
        ?.logicalOperator
      return [
        flatNode,
        ...flattenGoalTree(
          node.children,
          expandedGroups,
          node.id,
          groupOperator,
          depth + 1
        ),
      ]
    }

    return flatNode
  })
}

/** OSRS items can have several ids (variants); goals use the first one. */
export function resolveItemId(item: OsrsItem): number {
  return Array.isArray(item.id) ? item.id[0]! : item.id
}
