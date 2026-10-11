"use client"

import { useEffect, useState } from "react"

/**
 * Multi-selection of tree nodes: Ctrl/Cmd+Click toggles a node, a plain click
 * on an unselected node clears the selection, Escape clears it.
 */
export function useNodeSelection() {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())

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
        setSelectedNodes(new Set())
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedNodes.size])

  return {
    selectedNodes,
    setSelectedNodes,
    handleNodeClick,
    handleClearSelection,
    isNodeSelected,
  }
}
