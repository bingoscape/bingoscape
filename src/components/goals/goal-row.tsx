"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Trash2,
  GripVertical,
  Target,
  Package,
  Pencil,
  BarChart2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/number-input"
import { METRIC_GOAL_LABEL, getMetricTargetCopy } from "@/lib/osrs-metrics"
import { cn } from "@/lib/utils"
import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { GoalEditForm } from "./goal-edit-form"
import type { FlatGoalNode } from "./types"
import { useSortableNode } from "./use-sortable-node"

interface GoalRowProps {
  node: FlatGoalNode
  onDeleteGoal: (goalId: string) => void
  onRefresh: () => void
  hasSufficientRights: boolean
  isSelected: boolean
  onNodeClick: (
    nodeId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => void
}

export function GoalRow({
  node,
  onDeleteGoal,
  onRefresh,
  hasSufficientRights,
  isSelected,
  onNodeClick,
}: GoalRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const { attributes, listeners, setNodeRef, isOver, style } = useSortableNode(
    {
      id: node.id,
      depth: node.depth,
      disabled: !hasSufficientRights || isEditing,
    }
  )

  const goalData = node.data
  const itemGoal = goalData.goalType === "item" ? goalData.itemGoal : null
  const metricGoal =
    goalData.goalType === "metric" ? goalData.metricGoal : null

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-2",
        node.depth > 0 && "border-l-2 pl-3 @sm:pl-4 relative border-muted-foreground/30"
      )}
    >
      {node.depth > 0 && (
        <div className="absolute left-0 top-1/2 w-4 h-0.5 bg-muted-foreground/30 -translate-y-1/2" />
      )}
      {hasSufficientRights && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder goal: ${goalData.description}`}
          className="flex cursor-grab touch-none items-center justify-center rounded-sm p-1 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div
        className={cn(
          "flex-1 cursor-pointer transition-all",
          isEditing
            ? "rounded-md border bg-card p-3 shadow-sm my-1"
            : "flex items-center justify-between py-1 px-2 my-0.5 rounded-sm bg-muted/50 border border-muted/20 hover:bg-muted/80",
          isOver && "border-2 border-primary",
          isSelected && "border-2 border-info shadow-sm"
        )}
        onClick={(e) => !isEditing && onNodeClick(node.id, e)}
      >
        <div>
          {isEditing ? (
            <GoalEditForm
              goalId={node.id}
              goalData={goalData}
              parentOperator={node.parentOperator}
              onClose={() => setIsEditing(false)}
              onRefresh={onRefresh}
            />
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  // Keyboard equivalent of Ctrl/Cmd+Click: toggle the selection.
                  if (
                    e.target === e.currentTarget &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    e.preventDefault()
                    onNodeClick(node.id, e)
                  }
                }}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                {itemGoal ? (
                  <>
                    <Image
                      src={itemGoal.imageUrl}
                      alt={itemGoal.baseName}
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                    >
                      <Package className="mr-1 h-3 w-3" />
                      Item
                    </Badge>
                  </>
                ) : metricGoal ? (
                  <>
                    <BarChart2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-info"
                    />
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                      title={METRIC_GOAL_LABEL}
                    >
                      {getMetricTargetCopy(metricGoal.metricType).badge}
                    </Badge>
                  </>
                ) : (
                  <Target
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-success"
                  />
                )}
                <span className="min-w-0 text-sm wrap-anywhere">{goalData.description}</span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  Target: {formatNumber(goalData.targetValue)}
                </Badge>
              </div>
              {hasSufficientRights && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit goal: ${goalData.description}`}
                    onClick={() => setIsEditing(true)}
                    className="h-7 w-7 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <Pencil aria-hidden="true" className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete goal: ${goalData.description}`}
                    onClick={() => setConfirmingDelete(true)}
                    className="h-7 w-7 p-0 text-danger hover:text-danger pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmDeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete "${goalData.description}"?`}
        description="This removes the goal from the tile, along with any progress teams have recorded for it. This cannot be undone."
        confirmLabel="Delete goal"
        onConfirm={() => onDeleteGoal(node.id)}
      />
    </div>
  )
}
