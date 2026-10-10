"use client"

/* eslint-disable */
import { useMemo } from "react"

import { GoalTreeEditor } from "./goal-tree-editor"
import { buildGoalTree } from "@/lib/goal-tree"
import type { Tile, Goal } from "@/types/model"

interface GoalsTabProps {
  selectedTile: Tile | null
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  onNewGoalChange: (field: string, value: any) => void
  /** Called after the editor changed Goals; refreshes the page data. */
  onGoalsChanged?: () => void
  /** Rendered inside the Tile side panel (the panel body scrolls). */
  embedded?: boolean
}

export function GoalsTab({
  selectedTile,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
  onGoalsChanged,
  embedded = false,
}: GoalsTabProps) {
  // The tree comes from the Tile the page already loaded; every editor change
  // refreshes the route (onGoalsChanged), which delivers the new Tile.
  const goalTree = useMemo(
    () => buildGoalTree(selectedTile?.goals, selectedTile?.goalGroups),
    [selectedTile?.goals, selectedTile?.goalGroups]
  )

  const handleRefresh = () => {
    onGoalsChanged?.()
  }

  return (
    <div
      className={
        embedded
          ? "space-y-4 text-foreground"
          : "max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Goals Management</h3>
      </div>

      <GoalTreeEditor
        tileId={selectedTile?.id || ""}
        tree={goalTree}
        hasSufficientRights={hasSufficientRights}
        onRefresh={handleRefresh}
        onDeleteGoal={onDeleteGoal}
        onAddGoal={onAddGoal}
        newGoal={newGoal}
        onNewGoalChange={onNewGoalChange}
      />
    </div>
  )
}
