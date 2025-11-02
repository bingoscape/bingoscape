"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { useState } from "react"
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
import { createItemGoal } from "@/app/actions/bingo"
import { parseItemName } from "osrs-item-data"
import type { OsrsItem } from "@/types/osrs-items"

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
  const [goalType, setGoalType] = useState<"generic" | "item">("generic")
  const [selectedItem, setSelectedItem] = useState<OsrsItem | null>(null)
  const [itemGoalTargetValue, setItemGoalTargetValue] = useState<number>(1)

  const handleAddItemGoal = async () => {
    if (!tileId || !selectedItem) {
      toast({
        title: "Error",
        description: "Please select an item",
        variant: "destructive",
      })
      return
    }

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
      toast({
        title: "Item goal created",
        description: `Goal for ${selectedItem.name} has been created.`,
      })

      // Reset form
      setSelectedItem(null)
      setItemGoalTargetValue(1)
      setGoalType("generic")

      // Refresh tree
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to create item goal",
        variant: "destructive",
      })
    }
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
    setActiveId(event.active.id as string)
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
    const result = await createGoalGroup(tileId, newGroupOperator, newGroupParentId)
    if (result.success) {
      toast({
        title: "Group created",
        description: "Goal group has been created successfully.",
      })
      setShowNewGroupDialog(false)
      setNewGroupParentId(null)
      setNewGroupOperator("AND")
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
    const result = await updateGoalGroup(groupId, operator)
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
          <strong>Tip:</strong> Drag goals onto groups to nest them. Drag onto other goals to reorder. Groups with AND require all goals, OR requires at least one.
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
                hasSufficientRights={hasSufficientRights}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg opacity-80">
              <div className="text-sm font-medium">
                {flatTree.find((n) => n.id === activeId)?.type === "group" ? "Group" : "Goal"}
              </div>
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
                      <Label className="text-sm font-medium text-muted-foreground">Select OSRS Item</Label>
                      <div className="mt-1">
                        <OsrsItemSearch
                          onItemSelect={setSelectedItem}
                          selectedItem={selectedItem}
                          placeholder="Search for an item..."
                        />
                      </div>
                      {selectedItem && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Any variant of {selectedItem.baseName} will count toward this goal
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
                    disabled={!selectedItem}
                    className="w-full"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Add Item Goal
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
              <Select value={newGroupOperator} onValueChange={(v) => setNewGroupOperator(v as "AND" | "OR")}>
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND (all required)</SelectItem>
                  <SelectItem value="OR">OR (any required)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newGroupOperator === "AND"
                  ? "All goals in this group must be completed"
                  : "At least one goal in this group must be completed"}
              </p>
            </div>
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
  hasSufficientRights: boolean
}

function TreeNode({
  node,
  expanded,
  onToggle,
  onUpdateOperator,
  onDeleteGroup,
  onDeleteGoal,
  hasSufficientRights,
}: TreeNodeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: node.id,
    disabled: !hasSufficientRights,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${node.depth * 24}px`,
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
        <Card className={`flex-1 bg-blue-500/10 border-blue-500/30 transition-all ${isOver ? "border-blue-500 border-2 bg-blue-500/20" : ""}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <Layers className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Group</span>
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
      <Card className={`flex-1 transition-all ${isOver ? "border-primary border-2" : ""}`}>
        <CardContent className="p-3">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteGoal(node.id)}
                className="text-red-600 hover:text-red-700 h-7"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
