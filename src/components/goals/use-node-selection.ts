"use client"

import { useEffect, useState } from "react"

/**
 * Multi-selection of tree nodes: Ctrl/Cmd+Click (or Enter / Space on a focused
 * row) toggles a node, a plain click on an unselected node clears the
 * selection, Escape clears it unless a Sheet or Dialog is open.
 */
export function useNodeSelection() {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())

  const handleNodeClick = (
    nodeId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    // Ctrl (Windows) or Cmd (Mac); Enter / Space on a focused row act the same
    // way, since the keyboard has no "plain click".
    const isKeyboardToggle =
      "key" in event && (event.key === "Enter" || event.key === " ")
    const isModifierPressed =
      event.ctrlKey || event.metaKey || isKeyboardToggle

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
      if (e.key !== "Escape" || selectedNodes.size === 0) return
      // Escape that closes a Sheet, Dialog, Select or Popover is not meant for
      // the selection: those layers handle it (and mark it as handled) or the
      // event comes from inside one.
      if (e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')) {
        return
      }
      setSelectedNodes(new Set())
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
