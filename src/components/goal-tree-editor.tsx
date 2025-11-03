"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { useState, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  GripVertical,
  Layers,
  Target,
  Package,
  Loader2,
  Pencil,
  Save,
  X,
  CheckSquare,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import {
  createGoalGroup,
  moveGoalToGroup,
  moveGroupToGroup,
  updateGoalGroup,
  deleteGoalGroup,
  reorderItems,
  moveMultipleItems,
} from "@/app/actions/goal-groups"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { OsrsItemSearch } from "./osrs-item-search"
import { createItemGoal, updateGoal, updateItemGoal } from "@/app/actions/bingo"
import { parseItemName } from "osrs-item-data"
import type { OsrsItem } from "@/types/osrs-items"
import { cn } from "@/lib/utils"

interface GoalTreeEditorProps {
  tileId: string
  tree: GoalTreeNode[]
  hasSufficientRights: boolean
  onRefresh: () => void
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  newGoal: any
  onNewGoalChange: (field: string, value: any) => void
}

interface FlatNode {
  id: string
  type: "goal" | "group"
  data: any
  parentId: string | null
  depth: number
  orderIndex: number
}

export function GoalTreeEditor({
  tileId,
  tree,
  hasSufficientRights,
  onRefresh,
  onDeleteGoal,
  onAddGoal,
  newGoal,
  onNewGoalChange,
}: GoalTreeEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [newGroupOperator, setNewGroupOperator] = useState<"AND" | "OR">("AND")
  const [newGroupMinRequired, setNewGroupMinRequired] = useState<number>(1)
  const [goalType, setGoalType] = useState<"generic" | "item">("generic")
  const [selectedItems, setSelectedItems] = useState<OsrsItem[]>([])
  const [itemGoalTargetValue, setItemGoalTargetValue] = useState<number>(1)
  const [isCreatingBulk, setIsCreatingBulk] = useState(false)

  // Multi-selection state for moving multiple goals
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())

  // Selection handlers
  const handleNodeClick = (nodeId: string, event: React.MouseEvent) => {
    // Check if Ctrl (Windows) or Cmd (Mac) is pressed
    const isModifierPressed = event.ctrlKey || event.metaKey

    if (!isModifierPressed) {
      // Regular click - clear selection or do nothing if already selected
      if (!selectedNodes.has(nodeId)) {
        setSelectedNodes(new Set())
      }
    } else {
      // Ctrl/Cmd click - toggle selection
      setSelectedNodes((prev) => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
    }
  }

  const handleClearSelection = () => {
    setSelectedNodes(new Set())
  }

  const isNodeSelected = (nodeId: string): boolean => {
    return selectedNodes.has(nodeId)
  }

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedNodes.size > 0) {
        handleClearSelection()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedNodes.size])

  const handleAddItemGoal = async () => {
    if (!tileId || selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      })
      return
    }

    setIsCreatingBulk(true)
    const results = []
    let successCount = 0
    let failCount = 0

    // Create goals for each selected item
    for (const selectedItem of selectedItems) {
      const itemId = Array.isArray(selectedItem.id) ? selectedItem.id[0]! : selectedItem.id
      const parsed = parseItemName(selectedItem.name)

      const result = await createItemGoal(
        tileId,
        itemId,
        selectedItem.name,
        parsed.baseName,
        selectedItem.imageUrl,
        itemGoalTargetValue,
        parsed.variant ?? null
      )

      if (result.success) {
        successCount++
      } else {
        failCount++
      }
      results.push({ item: selectedItem.name, success: result.success })
    }

    setIsCreatingBulk(false)

    // Show summary toast
    if (failCount === 0) {
      toast({
        title: "Item goals created",
        description: `Successfully created ${successCount} item goal${successCount !== 1 ? 's' : ''}.`,
      })
    } else if (successCount === 0) {
      toast({
        title: "Error",
        description: `Failed to create all ${failCount} item goals.`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Partially completed",
        description: `Created ${successCount} goal${successCount !== 1 ? 's' : ''}, ${failCount} failed.`,
        variant: "default",
      })
    }

    // Reset form
    setSelectedItems([])
    setItemGoalTargetValue(1)
    setGoalType("generic")

    // Refresh tree
    onRefresh()
  }
  const [newGroupParentId, setNewGroupParentId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Flatten tree for drag and drop
  const flattenTree = (nodes: GoalTreeNode[], parentId: string | null = null, depth = 0): FlatNode[] => {
    const result: FlatNode[] = []

    nodes.forEach((node, index) => {
      result.push({
        id: node.id,
        type: node.type,
        data: node.data,
        parentId,
        depth,
        orderIndex: index,
      })

      if (node.type === "group" && node.children && expandedGroups.has(node.id)) {
        result.push(...flattenTree(node.children, node.id, depth + 1))
      }
    })

    return result
  }

  const flatTree = flattenTree(tree)

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string
    setActiveId(draggedId)

    // If dragging an unselected item and there are selections, auto-select it
    if (!selectedNodes.has(draggedId) && selectedNodes.size > 0) {
      setSelectedNodes((prev) => new Set([...prev, draggedId]))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeNode = flatTree.find((n) => n.id === active.id)
    const overNode = flatTree.find((n) => n.id === over.id)

    if (!activeNode || !overNode) return

    // Determine the target parent:
    // If dropping on a group, make that group the parent
    // If dropping on a goal, use that goal's parent
    const targetParentId = overNode.type === "group" ? overNode.id : overNode.parentId

    // Check if we're moving multiple items
    const isMultiMove = selectedNodes.size > 0 && selectedNodes.has(active.id as string)

    if (isMultiMove) {
      // Moving multiple selected items
      const itemsToMove = Array.from(selectedNodes).map((nodeId) => {
        const node = flatTree.find((n) => n.id === nodeId)
        return {
          id: nodeId,
          type: node?.type || ("goal" as "goal" | "group"),
        }
      })

      const result = await moveMultipleItems(itemsToMove, targetParentId)

      if (result.success) {
        if ("failedCount" in result && result.failedCount && result.failedCount > 0) {
          toast({
            title: "Partially completed",
            description: `Moved ${result.movedCount} item${result.movedCount !== 1 ? 's' : ''}, ${result.failedCount} failed.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Items moved",
            description: `Successfully moved ${result.movedCount} item${result.movedCount !== 1 ? 's' : ''}.`,
          })
        }
        setSelectedNodes(new Set()) // Clear selection after move
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to move items",
          variant: "destructive",
        })
      }
      onRefresh()
      return
    }

    // Single item move (original logic)
    // Moving to same parent - just reorder
    if (activeNode.parentId === targetParentId) {
      const siblings = flatTree.filter((n) => n.parentId === targetParentId)
      const oldIndex = siblings.findIndex((n) => n.id === active.id)
      const newIndex = siblings.findIndex((n) => n.id === over.id)

      const newOrder = arrayMove(siblings, oldIndex, newIndex)
      const updates = newOrder.map((node, index) => ({
        id: node.id,
        type: node.type,
        orderIndex: index,
      }))

      await reorderItems(updates)
      onRefresh()
    } else {
      // Moving to different parent
      if (activeNode.type === "goal") {
        const result = await moveGoalToGroup(activeNode.id, targetParentId)
        if (result.success) {
          toast({
            title: "Goal moved",
            description: "Goal has been moved to the group successfully.",
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to move goal",
            variant: "destructive",
          })
        }
      } else {
        const result = await moveGroupToGroup(activeNode.id, targetParentId)
        if (result.success) {
          toast({
            title: "Group moved",
            description: "Group has been moved successfully.",
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to move group",
            variant: "destructive",
          })
        }
      }
      onRefresh()
    }
  }

  const handleCreateGroup = async () => {
    const result = await createGoalGroup(tileId, newGroupOperator, newGroupParentId, newGroupMinRequired)
    if (result.success) {
      toast({
        title: "Group created",
        description: "Goal group has been created successfully.",
      })
      setShowNewGroupDialog(false)
      setNewGroupParentId(null)
      setNewGroupOperator("AND")
      setNewGroupMinRequired(1)
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create group",
        variant: "destructive",
      })
    }
  }

  const handleUpdateGroupOperator = async (groupId: string, operator: "AND" | "OR") => {
    const result = await updateGoalGroup(groupId, { logicalOperator: operator })
    if (result.success) {
      toast({
        title: "Updated",
        description: "Group operator updated successfully.",
      })
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update group",
        variant: "destructive",
      })
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    const result = await deleteGoalGroup(groupId)
    if (result.success) {
      toast({
        title: "Deleted",
        description: "Goal group deleted successfully.",
      })
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete group",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {hasSufficientRights && (flatTree.length > 0 || tree.length > 0) && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
          <strong>Tip:</strong> Drag goals onto groups to nest them. Drag onto other goals to reorder. Groups with AND require all goals, OR requires at least one. <strong>Ctrl/Cmd+Click</strong> to select multiple items.
        </div>
      )}

      {/* Selection Action Toolbar */}
      {selectedNodes.size > 0 && (
        <div className="border-2 border-blue-500 rounded-lg p-3 bg-background animate-in slide-in-from-top-2 fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedNodes.size} item{selectedNodes.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flatTree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {flatTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                expanded={expandedGroups.has(node.id)}
                onToggle={() => toggleGroup(node.id)}
                onUpdateOperator={handleUpdateGroupOperator}
                onDeleteGroup={handleDeleteGroup}
                onDeleteGoal={onDeleteGoal}
                onRefresh={onRefresh}
                hasSufficientRights={hasSufficientRights}
                isSelected={isNodeSelected(node.id)}
                onNodeClick={handleNodeClick}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg opacity-90 relative">
              <div className="text-sm font-medium">
                {flatTree.find((n) => n.id === activeId)?.type === "group" ? "Group" : "Goal"}
              </div>
              {selectedNodes.size > 1 && selectedNodes.has(activeId) && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shadow-md">
                  {selectedNodes.size}
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {hasSufficientRights && (
        <div className="space-y-2">
          <Button
            onClick={() => setShowNewGroupDialog(true)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <Layers className="h-4 w-4 mr-2" />
            Create Group
          </Button>

          <Card className="border-2 border-dashed border-border bg-muted/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="text-base font-medium">Add New Goal</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Goal Type Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Goal Type</Label>
                <RadioGroup
                  value={goalType}
                  onValueChange={(value) => setGoalType(value as "generic" | "item")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="generic" id="tree-generic" />
                    <Label htmlFor="tree-generic" className="cursor-pointer font-normal">
                      Generic Goal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item" id="tree-item" />
                    <Label htmlFor="tree-item" className="cursor-pointer font-normal flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      OSRS Item Goal
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Generic Goal Form */}
              {goalType === "generic" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="goalDescription" className="text-sm">
                        Description
                      </Label>
                      <Input
                        id="goalDescription"
                        value={newGoal.description || ""}
                        onChange={(e) => onNewGoalChange("description", e.target.value)}
                        placeholder="Complete the task..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="targetValue" className="text-sm">
                        Target Value
                      </Label>
                      <Input
                        id="targetValue"
                        type="number"
                        value={newGoal.targetValue?.toString() || ""}
                        onChange={(e) => onNewGoalChange("targetValue", Number.parseInt(e.target.value))}
                        placeholder="1"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={onAddGoal} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                </>
              )}

              {/* Item Goal Form */}
              {goalType === "item" && (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Select OSRS Items</Label>
                      <div className="mt-1">
                        <OsrsItemSearch
                          onItemSelect={(items) => {
                            if (Array.isArray(items)) {
                              setSelectedItems(items)
                            } else {
                              setSelectedItems([items])
                            }
                          }}
                          selectedItems={selectedItems}
                          placeholder="Search for items..."
                          multiSelect={true}
                        />
                      </div>
                      {selectedItems.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected - a separate goal will be created for each item
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="tree-itemTargetValue" className="text-sm font-medium text-muted-foreground">
                        Quantity Required
                      </Label>
                      <Input
                        id="tree-itemTargetValue"
                        type="number"
                        value={itemGoalTargetValue}
                        onChange={(e) => setItemGoalTargetValue(Number.parseInt(e.target.value) || 1)}
                        placeholder="1"
                        min="1"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of times this item must be obtained
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddItemGoal}
                    disabled={selectedItems.length === 0 || isCreatingBulk}
                    className="w-full"
                  >
                    {isCreatingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating {selectedItems.length} Goal{selectedItems.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Add Item Goal{selectedItems.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Goal Group</DialogTitle>
            <DialogDescription>
              Group goals together with logical operators (AND/OR) to control tile completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="operator">Logical Operator</Label>
              <Select value={newGroupOperator} onValueChange={(v) => {
                setNewGroupOperator(v as "AND" | "OR")
                if (v === "AND") {
                  setNewGroupMinRequired(1) // Reset to 1 when switching to AND
                }
              }}>
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND (all required)</SelectItem>
                  <SelectItem value="OR">OR (configurable required)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newGroupOperator === "AND"
                  ? "All goals in this group must be completed"
                  : `At least ${newGroupMinRequired} goal${newGroupMinRequired !== 1 ? 's' : ''} in this group must be completed`}
              </p>
            </div>
            {newGroupOperator === "OR" && (
              <div>
                <Label htmlFor="minRequired">Minimum Required Goals</Label>
                <Input
                  id="minRequired"
                  type="number"
                  min="1"
                  value={newGroupMinRequired}
                  onChange={(e) => setNewGroupMinRequired(Math.max(1, Number.parseInt(e.target.value) || 1))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How many goals must be completed for this OR group to be satisfied
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TreeNodeProps {
  node: FlatNode
  expanded: boolean
  onToggle: () => void
  onUpdateOperator: (groupId: string, operator: "AND" | "OR") => void
  onDeleteGroup: (groupId: string) => void
  onDeleteGoal: (goalId: string) => void
  onRefresh: () => void
  hasSufficientRights: boolean
  isSelected: boolean
  onNodeClick: (nodeId: string, event: React.MouseEvent) => void
}

function TreeNode({
  node,
  expanded,
  onToggle,
  onUpdateOperator,
  onDeleteGroup,
  onDeleteGoal,
  onRefresh,
  hasSufficientRights,
  isSelected,
  onNodeClick,
}: TreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editDescription, setEditDescription] = useState("")
  const [editTargetValue, setEditTargetValue] = useState<number>(1)
  const [editSelectedItem, setEditSelectedItem] = useState<OsrsItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Group name editing state
  const [isEditingGroupName, setIsEditingGroupName] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")

  // Group minRequiredGoals editing state
  const [isEditingMinRequired, setIsEditingMinRequired] = useState(false)
  const [editMinRequired, setEditMinRequired] = useState<number>(1)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: node.id,
    disabled: !hasSufficientRights || isEditing || isEditingGroupName || isEditingMinRequired,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${node.depth * 24}px`,
  }

  const handleStartEdit = () => {
    if (node.type !== "goal") return
    const goalData = node.data as any
    setEditDescription(goalData.description as string)
    setEditTargetValue(goalData.targetValue as number)

    // For item goals, set the current item
    if (goalData.goalType === "item" && goalData.itemGoal) {
      const itemGoal = goalData.itemGoal
      setEditSelectedItem({
        id: itemGoal.itemId,
        name: goalData.description,
        baseName: itemGoal.baseName,
        variant: itemGoal.exactVariant,
        imageUrl: itemGoal.imageUrl,
      } as OsrsItem)
    }

    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditDescription("")
    setEditTargetValue(1)
    setEditSelectedItem(null)
  }

  const handleSaveEdit = async () => {
    if (node.type !== "goal") return
    const goalData = node.data as any
    setIsSaving(true)

    try {
      if (goalData.goalType === "item" && editSelectedItem) {
        // Update item goal
        const itemId = Array.isArray(editSelectedItem.id) ? editSelectedItem.id[0]! : editSelectedItem.id
        const parsed = parseItemName(editSelectedItem.name)

        const result = await updateItemGoal(
          node.id,
          itemId,
          editSelectedItem.name,
          parsed.baseName,
          editSelectedItem.imageUrl,
          parsed.variant ?? null,
          editTargetValue
        )

        if (result.success) {
          toast({
            title: "Goal updated",
            description: "Item goal has been updated successfully.",
          })
          handleCancelEdit()
          onRefresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to update goal",
            variant: "destructive",
          })
        }
      } else {
        // Update generic goal
        const result = await updateGoal(node.id, {
          description: editDescription,
          targetValue: editTargetValue,
        })

        if (result.success) {
          toast({
            title: "Goal updated",
            description: "Goal has been updated successfully.",
          })
          handleCancelEdit()
          onRefresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to update goal",
            variant: "destructive",
          })
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartGroupEdit = () => {
    if (node.type !== "group") return
    const groupData = node.data as any
    setEditGroupName((groupData.name as string | null) || "")
    setIsEditingGroupName(true)
  }

  const handleCancelGroupEdit = () => {
    setIsEditingGroupName(false)
    setEditGroupName("")
  }

  const handleSaveGroupName = async () => {
    if (node.type !== "group") return
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
    if (node.type !== "group") return
    const groupData = node.data as any
    setEditMinRequired((groupData.minRequiredGoals as number) || 1)
    setIsEditingMinRequired(true)
  }

  const handleCancelMinRequiredEdit = () => {
    setIsEditingMinRequired(false)
    setEditMinRequired(1)
  }

  const handleSaveMinRequired = async () => {
    if (node.type !== "group") return
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
          description: result.error ?? "Failed to update minimum required goals",
          variant: "destructive",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (node.type === "group") {
    const groupData = node.data as any
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-2">
        {hasSufficientRights && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <Card
          className={cn(
            "flex-1 bg-blue-500/10 border-blue-500/30 transition-all cursor-pointer",
            isOver && "border-blue-500 border-2 bg-blue-500/20",
            isSelected && "border-blue-600 border-2 shadow-md"
          )}
          onClick={(e) => onNodeClick(node.id, e)}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              {isEditingGroupName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <Input
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="Group name (optional)"
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
                  <Button size="sm" onClick={handleSaveGroupName} disabled={isSaving} className="h-7">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelGroupEdit} className="h-7">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{(groupData.name as string | null) || "Group"}</span>
                    {hasSufficientRights && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartGroupEdit()
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {hasSufficientRights ? (
                      <Select
                        value={groupData.logicalOperator}
                        onValueChange={(v) => onUpdateOperator(node.id, v as "AND" | "OR")}
                      >
                        <SelectTrigger className="w-24 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={groupData.logicalOperator === "AND" ? "default" : "secondary"}>
                        {groupData.logicalOperator}
                      </Badge>
                    )}
                    {groupData.logicalOperator === "OR" && (
                      <>
                        {isEditingMinRequired ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              value={editMinRequired}
                              onChange={(e) => setEditMinRequired(Math.max(1, Number.parseInt(e.target.value) || 1))}
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
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleSaveMinRequired()
                              }}
                              disabled={isSaving}
                              className="h-7 w-7 p-0"
                            >
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelMinRequiredEdit()
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              Min: {(groupData.minRequiredGoals as number) || 1}
                            </Badge>
                            {hasSufficientRights && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartMinRequiredEdit()
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {hasSufficientRights && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteGroup(node.id)}
                      className="text-red-600 hover:text-red-700 h-7"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const goalData = node.data as any
  const isItemGoal = goalData.goalType === "item" && goalData.itemGoal

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {hasSufficientRights && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <Card
        className={cn(
          "flex-1 transition-all cursor-pointer",
          isOver && "border-primary border-2",
          isSelected && "border-blue-600 border-2 shadow-md"
        )}
        onClick={(e) => !isEditing && onNodeClick(node.id, e)}
      >
        <CardContent className="p-3">
          {isEditing ? (
            <div className="space-y-3">
              {/* Edit Mode */}
              {isItemGoal ? (
                <>
                  <div>
                    <Label className="text-xs">OSRS Item</Label>
                    <OsrsItemSearch
                      onItemSelect={(item) => {
                        if (Array.isArray(item)) {
                          setEditSelectedItem(item[0] || null)
                        } else {
                          setEditSelectedItem(item)
                        }
                      }}
                      selectedItem={editSelectedItem}
                      placeholder="Select item..."
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Goal description..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Target Value</Label>
                <Input
                  type="number"
                  value={editTargetValue}
                  onChange={(e) => setEditTargetValue(Number.parseInt(e.target.value) || 1)}
                  min="1"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving || (isItemGoal && !editSelectedItem) || (!isItemGoal && !editDescription.trim())}
                  className="flex-1 h-7 text-xs"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                {isItemGoal ? (
                  <>
                    <img
                      src={goalData.itemGoal.imageUrl}
                      alt={goalData.itemGoal.baseName}
                      className="h-6 w-6 object-contain flex-shrink-0"
                    />
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      <Package className="h-3 w-3 mr-1" />
                      Item
                    </Badge>
                  </>
                ) : (
                  <Target className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                <span className="text-sm">{goalData.description}</span>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  Target: {goalData.targetValue}
                </Badge>
              </div>
              {hasSufficientRights && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteGoal(node.id)}
                    className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
