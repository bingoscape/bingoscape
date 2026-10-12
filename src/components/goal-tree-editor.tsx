"use client"

import { useState } from "react"
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Layers, ListChecks, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { updateGoalGroup, deleteGoalGroup } from "@/app/actions/goal-groups"
import { AddGoalDrawer } from "@/components/goals/add-goal-drawer"
import { CreateGroupDialog } from "@/components/goals/create-group-dialog"
import { DragPreview } from "@/components/goals/drag-preview"
import { GoalsEmptyState } from "@/components/goals/goals-empty-state"
import { GoalsHelp } from "@/components/goals/goals-help"
import { PendingGoalRow } from "@/components/goals/pending-goal-row"
import { QuickAddBar } from "@/components/goals/quick-add-bar"
import { SelectionToolbar } from "@/components/goals/selection-toolbar"
import { TreeNode } from "@/components/goals/tree-node"
import type { GroupOperator } from "@/components/goals/types"
import { useGoalTreeDnd } from "@/components/goals/use-goal-tree-dnd"
import { useNodeSelection } from "@/components/goals/use-node-selection"
import {
  pendingGoalToNode,
  usePendingGoals,
} from "@/components/goals/use-pending-goals"
import { flattenGoalTree } from "@/components/goals/utils"
import { summarizeGoalCompletion } from "@/lib/goal-summary"

interface GoalTreeEditorProps {
  tileId: string
  tree: GoalTreeNode[]
  hasSufficientRights: boolean
  onRefresh: () => void
  onDeleteGoal: (goalId: string) => void
  /** Whether the Board has a Wise Old Man competition (feeds XP / Kills progress). */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
}

export function GoalTreeEditor({
  tileId,
  tree,
  hasSufficientRights,
  onRefresh,
  onDeleteGoal,
  womLinked,
  onOpenTrackerSettings,
}: GoalTreeEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [isAddGoalDrawerOpen, setIsAddGoalDrawerOpen] = useState(false)
  const [addGoalParentId, setAddGoalParentId] = useState<string | null>(null)

  // The Goals added from the quick-add bar that the tree does not show yet.
  const { pendingGoals, addGoal } = usePendingGoals({ tileId, tree, onRefresh })
  const isEmpty = tree.length === 0 && pendingGoals.length === 0
  // Decided once, when the editor appears: an empty Tile invites the first add.
  const [focusQuickAddOnMount] = useState(
    () => hasSufficientRights && tree.length === 0
  )
  const completionSummary = summarizeGoalCompletion([
    ...tree,
    ...pendingGoals.map(pendingGoalToNode),
  ])

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

  const { sensors, activeId, handleDragStart, handleDragEnd } = useGoalTreeDnd({
    flatTree,
    selectedNodes,
    setSelectedNodes,
    onRefresh,
  })

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
      {hasSufficientRights && (
        <QuickAddBar
          onAdd={addGoal}
          womLinked={womLinked}
          onOpenTrackerSettings={onOpenTrackerSettings}
          focusOnMount={focusQuickAddOnMount}
          prominent={isEmpty}
        />
      )}

      {(completionSummary || (hasSufficientRights && !isEmpty)) && (
        <div className="space-y-1">
          {completionSummary && (
            <div className="bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <ListChecks
                aria-hidden="true"
                className="text-primary mt-0.5 h-4 w-4 shrink-0"
              />
              <p>{completionSummary}</p>
            </div>
          )}
          {hasSufficientRights && !isEmpty && <GoalsHelp />}
        </div>
      )}

      {isEmpty && <GoalsEmptyState canManage={hasSufficientRights} />}

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
          {!isEmpty && (
            <div className="border-border relative ml-1 space-y-2 border-l pl-2 [--goal-indent:0.75rem] @sm:ml-2 @sm:pl-4 @sm:[--goal-indent:1.25rem]">
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
              {/* Not sortable: pending Goals can't be dragged or edited yet. */}
              {pendingGoals.map((pending) => (
                <PendingGoalRow
                  key={pending.key}
                  pending={pending}
                  hasHandleSpace={hasSufficientRights}
                />
              ))}
            </div>
          )}
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <DragPreview
              isGroup={
                flatTree.find((n) => n.id === activeId)?.type === "group"
              }
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
            Add several goals
          </Button>

          <AddGoalDrawer
            open={isAddGoalDrawerOpen}
            onOpenChange={setIsAddGoalDrawerOpen}
            tileId={tileId}
            parentGroupId={addGoalParentId}
            onRefresh={onRefresh}
            womLinked={womLinked}
            onOpenTrackerSettings={onOpenTrackerSettings}
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
