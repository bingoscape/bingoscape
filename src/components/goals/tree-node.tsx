"use client"

import { GoalRow } from "./goal-row"
import { GroupRow } from "./group-row"
import type { FlatNode, GroupOperator } from "./types"

interface TreeNodeProps {
  node: FlatNode
  expanded: boolean
  onToggle: () => void
  onUpdateOperator: (groupId: string, operator: GroupOperator) => void
  onDeleteGroup: (groupId: string) => void
  onDeleteGoal: (goalId: string) => void
  /** Opens the add-goal drawer for a group (a group row's "Add" button). */
  onOpenAddGoal: (parentGroupId: string | null) => void
  onRefresh: () => void
  hasSufficientRights: boolean
  isSelected: boolean
  onNodeClick: (
    nodeId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => void
}

/** Renders one visible tree node as a group row or a goal row. */
export function TreeNode({
  node,
  expanded,
  onToggle,
  onUpdateOperator,
  onDeleteGroup,
  onDeleteGoal,
  onOpenAddGoal,
  onRefresh,
  hasSufficientRights,
  isSelected,
  onNodeClick,
}: TreeNodeProps) {
  if (node.type === "group") {
    return (
      <GroupRow
        node={node}
        expanded={expanded}
        onToggle={onToggle}
        onUpdateOperator={onUpdateOperator}
        onDeleteGroup={onDeleteGroup}
        onOpenAddGoal={onOpenAddGoal}
        onRefresh={onRefresh}
        hasSufficientRights={hasSufficientRights}
        isSelected={isSelected}
        onNodeClick={onNodeClick}
      />
    )
  }

  return (
    <GoalRow
      node={node}
      onDeleteGoal={onDeleteGoal}
      onRefresh={onRefresh}
      hasSufficientRights={hasSufficientRights}
      isSelected={isSelected}
      onNodeClick={onNodeClick}
    />
  )
}
