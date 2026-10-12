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
import { cn } from "@/lib/utils"
import { GoalEditForm } from "./goal-edit-form"
import type { FlatGoalNode } from "./types"
import { useSortableNode } from "./use-sortable-node"

interface GoalRowProps {
  node: FlatGoalNode
  onDeleteGoal: (goalId: string) => void
  onRefresh: () => void
  hasSufficientRights: boolean
  isSelected: boolean
  onNodeClick: (nodeId: string, event: React.MouseEvent) => void
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
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
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
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                    <BarChart2 className="h-4 w-4 shrink-0 text-info" />
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                    >
                      Metric ({metricGoal.metricType})
                    </Badge>
                  </>
                ) : (
                  <Target className="h-4 w-4 shrink-0 text-success" />
                )}
                <span className="min-w-0 text-sm wrap-anywhere">{goalData.description}</span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  Target: {goalData.targetValue}
                </Badge>
              </div>
              {hasSufficientRights && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteGoal(node.id)}
                    className="h-7 w-7 p-0 text-danger hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
