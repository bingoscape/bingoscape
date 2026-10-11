"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Layers, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { updateGoalGroup, deleteGoalGroup } from "@/app/actions/goal-groups"
import type { Goal } from "@/types/model"
import { AddGoalDrawer } from "@/components/goals/add-goal-drawer"
import { CreateGroupDialog } from "@/components/goals/create-group-dialog"
import { DragPreview } from "@/components/goals/drag-preview"
import { SelectionToolbar } from "@/components/goals/selection-toolbar"
import { TreeNode } from "@/components/goals/tree-node"
import type { GroupOperator } from "@/components/goals/types"
import { useGoalTreeDnd } from "@/components/goals/use-goal-tree-dnd"
import { useNodeSelection } from "@/components/goals/use-node-selection"
import { flattenGoalTree } from "@/components/goals/utils"

interface GoalTreeEditorProps {
  tileId: string
  tree: GoalTreeNode[]
  hasSufficientRights: boolean
  onRefresh: () => void
  onDeleteGoal: (goalId: string) => void
  onAddGoal: (parentGroupId?: string | null) => void | Promise<void>
  newGoal: Partial<Goal>
  onNewGoalChange: (field: string, value: unknown) => void
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
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [isAddGoalDrawerOpen, setIsAddGoalDrawerOpen] = useState(false)
  const [addGoalParentId, setAddGoalParentId] = useState<string | null>(null)

  const openAddGoalDrawer = (parentId: string | null = null) => {
    setAddGoalParentId(parentId)
    setIsAddGoalDrawerOpen(true)
  }

  // Multi-selection state for moving multiple goals
  const {
    selectedNodes,
    setSelectedNodes,
    handleNodeClick,
    handleClearSelection,
    isNodeSelected,
  } = useNodeSelection()

  // Flatten tree for drag and drop
  const flatTree = flattenGoalTree(tree, expandedGroups)

  const { sensors, activeId, handleDragStart, handleDragEnd } = useGoalTreeDnd(
    { flatTree, selectedNodes, setSelectedNodes, onRefresh }
  )

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

  const handleUpdateGroupOperator = async (
    groupId: string,
    operator: GroupOperator
  ) => {
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
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong>Tip:</strong> Drag goals onto groups to nest them. Drag onto
          other goals to reorder. Groups with AND require all goals, OR requires
          at least one. <strong>Ctrl/Cmd+Click</strong> to select multiple
          items.
        </div>
      )}

      {/* Selection Action Toolbar */}
      {selectedNodes.size > 0 && (
        <SelectionToolbar
          selectedCount={selectedNodes.size}
          onClear={handleClearSelection}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={flatTree.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="relative ml-1 space-y-2 border-l border-border pl-2 [--goal-indent:0.75rem] @sm:ml-2 @sm:pl-4 @sm:[--goal-indent:1.25rem]">
            {flatTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                expanded={expandedGroups.has(node.id)}
                onToggle={() => toggleGroup(node.id)}
                onUpdateOperator={handleUpdateGroupOperator}
                onDeleteGroup={handleDeleteGroup}
                onDeleteGoal={onDeleteGoal}
                onOpenAddGoal={openAddGoalDrawer}
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
            <DragPreview
              isGroup={flatTree.find((n) => n.id === activeId)?.type === "group"}
              selectedCount={
                selectedNodes.size > 1 && selectedNodes.has(activeId)
                  ? selectedNodes.size
                  : null
              }
            />
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
            <Layers className="mr-2 h-4 w-4" />
            Create Group
          </Button>

          <Button
            onClick={() => openAddGoalDrawer(null)}
            variant="outline"
            className="w-full"
          >
            <Target className="mr-2 h-4 w-4" />
            Add New Goal
          </Button>

          <AddGoalDrawer
            open={isAddGoalDrawerOpen}
            onOpenChange={setIsAddGoalDrawerOpen}
            tileId={tileId}
            parentGroupId={addGoalParentId}
            newGoal={newGoal}
            onNewGoalChange={onNewGoalChange}
            onAddGoal={onAddGoal}
            onCreated={() => {
              setIsAddGoalDrawerOpen(false)
              setAddGoalParentId(null)
            }}
            onRefresh={onRefresh}
          />
        </div>
      )}

      <CreateGroupDialog
        open={showNewGroupDialog}
        onOpenChange={setShowNewGroupDialog}
        tileId={tileId}
        parentGroupId={null}
        onRefresh={onRefresh}
      />
    </div>
  )
}
