"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent, RefObject } from "react"
import { cn } from "@/lib/utils"
import {
  MAX_SIDE_FRACTION,
  MIN_SIDE_WIDTH,
  clampSideWidth,
} from "@/lib/workspace-prefs"

const KEY_STEP = 16
const KEY_STEP_LARGE = 64
/** Width of the handle's column; the side panel starts right after it. */
const HANDLE_WIDTH = 12

interface SplitHandleProps {
  /** The grid holding the Board and the side panel. */
  containerRef: RefObject<HTMLElement | null>
  /** The side panel (`aria-controls` target, measured for the ARIA values). */
  sideRef: RefObject<HTMLElement | null>
  controlsId: string
  /** Called on every drag/keyboard step with the new side width in px. */
  onResize: (width: number) => void
  /** Called once a drag or key step settles. */
  onCommit: (width: number) => void
  onReset: () => void
  onToggleCollapse: () => void
}

/**
 * Draggable divider between the Board and the side panel. Implements the
 * WAI-ARIA window splitter pattern: arrow keys resize, Home/End jump to the
 * limits, Enter collapses, double-click resets.
 */
export function SplitHandle({
  containerRef,
  sideRef,
  controlsId,
  onResize,
  onCommit,
  onReset,
  onToggleCollapse,
}: SplitHandleProps) {
  const [dragging, setDragging] = useState(false)
  const [measured, setMeasured] = useState({ side: 0, container: 0 })
  const latestWidth = useRef(0)

  useEffect(() => {
    const side = sideRef.current
    const container = containerRef.current
    if (!side || !container) return
    const measure = () =>
      setMeasured({
        side: side.getBoundingClientRect().width,
        container: container.getBoundingClientRect().width,
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(side)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, sideRef])

  const apply = useCallback(
    (width: number) => {
      const container = containerRef.current
      if (!container) return null
      const next = clampSideWidth(
        width,
        container.getBoundingClientRect().width
      )
      latestWidth.current = next
      onResize(next)
      return next
    },
    [containerRef, onResize]
  )

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    latestWidth.current = measured.side
    setDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const container = containerRef.current
    if (!container) return
    const { right } = container.getBoundingClientRect()
    apply(right - event.clientX - HANDLE_WIDTH / 2)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
    onCommit(latestWidth.current)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    const containerWidth = container.getBoundingClientRect().width
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
    let target: number | null = null
    switch (event.key) {
      // The handle sits left of the side panel, so moving it left grows it.
      case "ArrowLeft":
        target = measured.side + step
        break
      case "ArrowRight":
        target = measured.side - step
        break
      case "Home":
        target = MIN_SIDE_WIDTH
        break
      case "End":
        target = containerWidth * MAX_SIDE_FRACTION
        break
      case "Enter":
        event.preventDefault()
        onToggleCollapse()
        return
      default:
        return
    }
    event.preventDefault()
    const next = apply(target)
    if (next !== null) onCommit(next)
  }

  const percent = (px: number) =>
    measured.container ? Math.round((px / measured.container) * 100) : 0

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize board and side panel"
      aria-controls={controlsId}
      aria-valuenow={percent(measured.side)}
      aria-valuemin={percent(MIN_SIDE_WIDTH)}
      aria-valuemax={Math.round(MAX_SIDE_FRACTION * 100)}
      aria-valuetext={`Side panel ${Math.round(measured.side)} pixels wide`}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={cn(
        "group relative hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center select-none lg:flex",
        // Wider invisible hit area than the 12px column.
        "after:absolute after:-inset-x-1.5 after:inset-y-0 [@media(pointer:coarse)]:after:-inset-x-2.5",
        "focus-visible:outline-none"
      )}
    >
      <div
        className={cn(
          "bg-border h-full w-1 rounded-full transition-colors",
          "group-hover:bg-primary/60 group-focus-visible:bg-primary group-focus-visible:ring-ring group-focus-visible:ring-2",
          dragging && "bg-primary"
        )}
      />
    </div>
  )
}
