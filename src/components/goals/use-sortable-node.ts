"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface UseSortableNodeOptions {
  id: string
  depth: number
  disabled: boolean
}

/** dnd-kit sortable wiring shared by group and goal rows, including the capped indent. */
export function useSortableNode({
  id,
  depth,
  disabled,
}: UseSortableNodeOptions) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Visual indent is capped at depth 3 so deep trees never push content out of the panel.
    marginLeft:
      depth > 0
        ? `calc(${Math.min(depth, 3)} * var(--goal-indent, 1.5rem))`
        : "0px",
  }

  return { attributes, listeners, setNodeRef, isOver, style }
}
