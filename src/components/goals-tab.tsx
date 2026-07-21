"use client"

/* eslint-disable */
import { useState, useEffect } from "react"

import { GoalTreeEditor } from "./goal-tree-editor"
import { getGoalTree, type GoalTreeNode } from "@/app/actions/goal-groups"
import type { Tile, Goal } from "@/types/model"

interface GoalsTabProps {
  selectedTile: Tile | null
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  onNewGoalChange: (field: string, value: any) => void
}

export function GoalsTab({
  selectedTile,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
}: GoalsTabProps) {
  const [goalTree, setGoalTree] = useState<GoalTreeNode[]>([])

  // Load goal tree when selectedTile changes
  useEffect(() => {
    if (selectedTile?.id) {
      loadGoalTree()
    }
  }, [selectedTile?.id])

  const loadGoalTree = async () => {
    if (!selectedTile?.id) return
    const tree = await getGoalTree(selectedTile.id)
    setGoalTree(tree)
  }

  return (
    <div className="max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Goals Management</h3>
      </div>

      <GoalTreeEditor
        tileId={selectedTile?.id || ""}
        tree={goalTree}
        hasSufficientRights={hasSufficientRights}
        onRefresh={loadGoalTree}
        onDeleteGoal={onDeleteGoal}
        onAddGoal={onAddGoal}
        newGoal={newGoal}
        onNewGoalChange={onNewGoalChange}
      />
    </div>
  )
}
