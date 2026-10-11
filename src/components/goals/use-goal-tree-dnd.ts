"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "@/hooks/use-toast"
import {
  moveGoalToGroup,
  moveGroupToGroup,
  reorderItems,
  moveMultipleItems,
} from "@/app/actions/goal-groups"
import type { FlatNode } from "./types"

interface UseGoalTreeDndOptions {
  flatTree: FlatNode[]
  selectedNodes: Set<string>
  setSelectedNodes: Dispatch<SetStateAction<Set<string>>>
  onRefresh: () => void
}

/** dnd-kit sensors and drag handlers for reordering and nesting Goals and groups. */
export function useGoalTreeDnd({
  flatTree,
  selectedNodes,
  setSelectedNodes,
  onRefresh,
}: UseGoalTreeDndOptions) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
    const targetParentId =
      overNode.type === "group" ? overNode.id : overNode.parentId

    // Check if we're moving multiple items
    const isMultiMove =
      selectedNodes.size > 0 && selectedNodes.has(active.id as string)

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
        if (
          "failedCount" in result &&
          result.failedCount &&
          result.failedCount > 0
        ) {
          toast({
            title: "Partially completed",
            description: `Moved ${result.movedCount} item${result.movedCount !== 1 ? "s" : ""}, ${result.failedCount} failed.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Items moved",
            description: `Successfully moved ${result.movedCount} item${result.movedCount !== 1 ? "s" : ""}.`,
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

  return { sensors, activeId, handleDragStart, handleDragEnd }
}
