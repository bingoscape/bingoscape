"use client"

import { useMemo } from "react"
import { GoalTreeEditor } from "@/components/goal-tree-editor"
import { buildGoalTree } from "@/lib/goal-tree"
import type { Tile } from "@/types/model"

interface GoalsTabProps {
  selectedTile: Tile | null
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  /** Whether the Board has a Wise Old Man competition (feeds XP / Kills progress). */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
  /** Called after the editor changed Goals; refreshes the page data. */
  onGoalsChanged?: () => void
  /** Rendered inside the Tile side panel (the panel body scrolls). */
  embedded?: boolean
}

export function GoalsTab({
  selectedTile,
  hasSufficientRights,
  onDeleteGoal,
  womLinked,
  onOpenTrackerSettings,
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
        <h3 className="min-w-0 text-base font-semibold @sm:text-lg">Goals Management</h3>
      </div>

      <GoalTreeEditor
        tileId={selectedTile?.id || ""}
        tree={goalTree}
        hasSufficientRights={hasSufficientRights}
        onRefresh={handleRefresh}
        onDeleteGoal={onDeleteGoal}
        womLinked={womLinked}
        onOpenTrackerSettings={onOpenTrackerSettings}
      />
    </div>
  )
}
