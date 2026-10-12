"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  GripVertical,
  Layers,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { updateGoalGroup } from "@/app/actions/goal-groups"
import { cn } from "@/lib/utils"
import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { GroupOperatorControl } from "./group-operator-control"
import type { FlatGroupNode, GroupOperator } from "./types"
import { useSortableNode } from "./use-sortable-node"

interface GroupRowProps {
  node: FlatGroupNode
  expanded: boolean
  onToggle: () => void
  onUpdateOperator: (groupId: string, operator: GroupOperator) => void
  onDeleteGroup: (groupId: string) => void
  /** Opens the add-goal drawer for this group. */
  onOpenAddGoal: (parentGroupId: string | null) => void
  onRefresh: () => void
  hasSufficientRights: boolean
  isSelected: boolean
  onNodeClick: (
    nodeId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => void
}

export function GroupRow({
  node,
  expanded,
  onToggle,
  onUpdateOperator,
  onDeleteGroup,
  onOpenAddGoal,
  onRefresh,
  hasSufficientRights,
  isSelected,
  onNodeClick,
}: GroupRowProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Group name editing state
  const [isEditingGroupName, setIsEditingGroupName] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")

  // Group minRequiredGoals editing state
  const [isEditingMinRequired, setIsEditingMinRequired] = useState(false)
  const [editMinRequired, setEditMinRequired] = useState<number>(1)

  const { attributes, listeners, setNodeRef, isOver, style } = useSortableNode(
    {
      id: node.id,
      depth: node.depth,
      disabled:
        !hasSufficientRights || isEditingGroupName || isEditingMinRequired,
    }
  )

  const groupData = node.data

  const handleStartGroupEdit = () => {
    setEditGroupName(groupData.name || "")
    setIsEditingGroupName(true)
  }

  const handleCancelGroupEdit = () => {
    setIsEditingGroupName(false)
    setEditGroupName("")
  }

  const handleSaveGroupName = async () => {
    setIsSaving(true)

    try {
      const result = await updateGoalGroup(node.id, {
        name: editGroupName.trim() || null,
      })

      if (result.success) {
        toast({
          title: "Group updated",
          description: "Group name has been updated successfully.",
        })
        handleCancelGroupEdit()
        onRefresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update group name",
          variant: "destructive",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartMinRequiredEdit = () => {
    setEditMinRequired(groupData.minRequiredGoals || 1)
    setIsEditingMinRequired(true)
  }

  const handleCancelMinRequiredEdit = () => {
    setIsEditingMinRequired(false)
    setEditMinRequired(1)
  }

  const handleSaveMinRequired = async () => {
    setIsSaving(true)

    try {
      const result = await updateGoalGroup(node.id, {
        minRequiredGoals: editMinRequired,
      })

      if (result.success) {
        toast({
          title: "Group updated",
          description: "Minimum required goals has been updated successfully.",
        })
        handleCancelMinRequiredEdit()
        onRefresh()
      } else {
        toast({
          title: "Error",
          description:
            result.error ?? "Failed to update minimum required goals",
          variant: "destructive",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-2",
        node.depth > 0 && "border-l-2 pl-3 @sm:pl-4 mb-2 relative",
        node.depth > 0 && groupData.logicalOperator === "SUM" ? "border-chart-5/30" :
        node.depth > 0 && groupData.logicalOperator === "OR" ? "border-chart-5/30" :
        node.depth > 0 ? "border-info/30" : ""
      )}
    >
      {node.depth > 0 && (
        <div className={cn(
          "absolute left-0 top-1/2 w-4 h-0.5 -translate-y-1/2",
          groupData.logicalOperator === "SUM" ? "bg-chart-5/30" :
          groupData.logicalOperator === "OR" ? "bg-chart-5/30" :
          "bg-info/30"
        )} />
      )}
      {hasSufficientRights && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder group: ${groupData.name || "Group"}`}
          className="flex cursor-grab touch-none items-center justify-center rounded-sm p-1 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div
        className={cn(
          "flex-1 cursor-pointer transition-all rounded-md py-1.5 px-3 border-l-2 mb-0.5",
          groupData.logicalOperator === "SUM"
            ? "border-success bg-success/30 "
            : groupData.logicalOperator === "OR"
              ? "border-chart-5 bg-chart-5/30 "
              : "border-info bg-info/30 ",
          isOver && "border-2",
          isSelected && "border-2 shadow-sm"
        )}
        onClick={(e) => onNodeClick(node.id, e)}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            {isEditingGroupName ? (
              <div className="flex flex-1 items-center gap-2">
                <Layers
                  className={cn(
                    "h-4 w-4",
                    groupData.logicalOperator === "SUM"
                      ? "text-chart-5"
                      : "text-info"
                  )}
                />
                <Input
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="Group name (optional)"
                  aria-label="Group name"
                  className="h-7 flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSaveGroupName()
                    } else if (e.key === "Escape") {
                      handleCancelGroupEdit()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  aria-label="Save group name"
                  onClick={handleSaveGroupName}
                  disabled={isSaving}
                  className="h-7 pointer-coarse:min-w-11"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Cancel renaming group"
                  onClick={handleCancelGroupEdit}
                  className="h-7 pointer-coarse:min-w-11"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${expanded ? "Collapse" : "Expand"} group: ${groupData.name || "Group"}`}
                    aria-expanded={expanded}
                    onClick={onToggle}
                    className="h-6 w-6 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    {expanded ? (
                      <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    )}
                  </Button>
                  <span
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
                    className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    <Layers
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0",
                        groupData.logicalOperator === "SUM"
                          ? "text-chart-5"
                          : "text-info"
                      )}
                    />
                    <span className="min-w-0 font-medium wrap-anywhere">
                      {groupData.name || "Group"}
                    </span>
                  </span>
                  {hasSufficientRights && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Rename group: ${groupData.name || "Group"}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartGroupEdit()
                      }}
                      className="h-6 w-6 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                    >
                      <Pencil aria-hidden="true" className="h-3 w-3" />
                    </Button>
                  )}
                  <GroupOperatorControl
                    operator={groupData.logicalOperator}
                    hasSufficientRights={hasSufficientRights}
                    onChange={(operator) =>
                      onUpdateOperator(node.id, operator)
                    }
                  />
                  {(groupData.logicalOperator === "OR" ||
                    groupData.logicalOperator === "SUM") && (
                    <>
                      {isEditingMinRequired ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            value={editMinRequired}
                            onChange={(e) =>
                              setEditMinRequired(
                                Math.max(
                                  1,
                                  Number.parseInt(e.target.value) || 1
                                )
                              )
                            }
                            aria-label="Minimum required goals"
                            className="h-7 w-16 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === "Enter") {
                                void handleSaveMinRequired()
                              } else if (e.key === "Escape") {
                                handleCancelMinRequiredEdit()
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            aria-label="Save minimum required goals"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleSaveMinRequired()
                            }}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          >
                            {isSaving ? (
                              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save aria-hidden="true" className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Cancel editing minimum required goals"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelMinRequiredEdit()
                            }}
                            className="h-7 w-7 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                          >
                            <X aria-hidden="true" className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {groupData.logicalOperator === "SUM"
                              ? "Target:"
                              : "Min:"}{" "}
                            {groupData.minRequiredGoals || 1}
                          </Badge>
                          {hasSufficientRights && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={
                                groupData.logicalOperator === "SUM"
                                  ? "Edit group target"
                                  : "Edit minimum required goals"
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartMinRequiredEdit()
                              }}
                              className="h-6 w-6 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                            >
                              <Pencil aria-hidden="true" className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {hasSufficientRights && (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenAddGoal(node.id)
                      }}
                      className="h-7 text-primary hover:text-primary/80 pointer-coarse:min-h-11"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4 mr-1" />
                      <span className="text-xs">Add</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete group: ${groupData.name || "Group"}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmingDelete(true)
                      }}
                      className="h-7 text-danger hover:text-danger p-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete group "${groupData.name || "Group"}"?`}
        description="Only the group is deleted. The goals and groups inside it are kept and move up to the level above."
        confirmLabel="Delete group"
        onConfirm={() => onDeleteGroup(node.id)}
      />
    </div>
  )
}
